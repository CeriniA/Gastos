import {
  impliedRate,
  isFutureDay,
  MS_PER_DAY,
  MS_PER_SECOND,
  scaleCents,
  shiftMoment,
  spendingCents,
  TRASH_RETENTION_DAYS,
  descendantIds,
  transactionShapeIssues,
  type Account,
  type Category,
  type Installment,
  type IsoDate,
  type LastRate,
  type MonthSummary,
  type Paginated,
  type Tag,
  type Transaction,
  type TransactionCreate,
  type TransactionItem,
  type TransactionListQuery,
  type TransactionSource,
  type TransactionStatus,
  type TransactionUpdate,
} from '@gastos/shared';
import type { WriteOptions } from '../../core/db/transaction';
import { NotFoundError, ValidationError } from '../../core/errors/errors';
import { dueDateFor, resolvePaymentDate, type PeriodDates } from './paymentDate';
import { duplicateKey, installmentKey } from './duplicateKey';
import { joinSameCategory } from './splits';
import type { TransactionRecord, TransactionsRepository } from './transactions.repository';

/** What the transactions module needs from the rest of the app. */
export interface TransactionDependencies {
  listAccounts(): Promise<Account[]>;
  listCategories(options?: WriteOptions): Promise<Category[]>;
  listTags(options?: WriteOptions): Promise<Tag[]>;
  /** Closing and due dates of every card statement, which decide when card purchases are paid. */
  listCardPeriods(options?: WriteOptions): Promise<PeriodDates[]>;
  /** Today's calendar day in the app's time zone. */
  today(): IsoDate;
  /** The current moment: when something is sent to the trash and when the trash is old enough to empty. */
  now(): Date;
}

/** The lookups every validation needs, loaded once per operation. */
interface References {
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  tagIds: Set<string>;
  /** Card statements per account. */
  periods: Map<string, PeriodDates[]>;
  today: IsoDate;
}

interface Origin {
  source: TransactionSource;
  installment?: Installment | null;
  /** The uploaded document the transaction was read from. */
  documentId?: string;
  /** Future installments are stored as projected; everything else is confirmed. */
  status?: TransactionStatus;
  /** The card statement a transfer pays. */
  cardPeriodId?: string;
}

/** One transaction to store in bulk, with what its origin knows about it. */
export interface BulkEntry {
  input: TransactionCreate;
  installment: Installment | null;
  documentId?: string;
  status?: TransactionStatus;
}

type Issue = { path: string; message: string };

export function createTransactionsService(repository: TransactionsRepository, deps: TransactionDependencies) {
  async function loadReferences(options: WriteOptions = {}): Promise<References> {
    const [accounts, categories, tags, periods] = await Promise.all([
      deps.listAccounts(),
      deps.listCategories(options),
      deps.listTags(options),
      deps.listCardPeriods(options),
    ]);
    const periodsByAccount = new Map<string, PeriodDates[]>();
    for (const period of periods) {
      periodsByAccount.set(period.accountId, [...(periodsByAccount.get(period.accountId) ?? []), period]);
    }
    return {
      accounts: new Map(accounts.map((account) => [account.id, account])),
      categories: new Map(categories.map((category) => [category.id, category])),
      tagIds: new Set(tags.map((tag) => tag.id)),
      periods: periodsByAccount,
      today: deps.today(),
    };
  }

  /**
   * Checks an input against every business rule and returns what to store.
   * `previous` is the stored transaction on an update: references it already
   * had may stay even if they were archived since.
   */
  function prepare(
    input: TransactionCreate,
    refs: References,
    origin: Origin,
    previous?: Transaction,
  ): TransactionRecord {
    const issues: Issue[] = [...transactionShapeIssues(input)];

    const account = refs.accounts.get(input.accountId);
    if (!account) {
      issues.push({ path: 'accountId', message: 'Account does not exist' });
    } else {
      if (account.archived && previous?.accountId !== account.id) {
        issues.push({ path: 'accountId', message: 'Account is archived' });
      }
      if (account.currency !== input.currency) {
        issues.push({ path: 'currency', message: 'Currency must match the account currency' });
      }
    }

    // Only projected items (future installments) may be dated ahead.
    const status = origin.status ?? previous?.status ?? 'confirmed';
    if (isFutureDay(input.date, refs.today) && status !== 'projected') {
      issues.push({ path: 'date', message: 'Date cannot be in the future' });
    }

    if (input.type === 'transfer' && input.toAccountId) {
      const destination = refs.accounts.get(input.toAccountId);
      if (!destination) {
        issues.push({ path: 'toAccountId', message: 'Destination account does not exist' });
      } else if (account) {
        const crossCurrency = destination.currency !== account.currency;
        if (crossCurrency && input.toAmountCents === null) {
          issues.push({ path: 'toAmountCents', message: 'A transfer between currencies needs both amounts' });
        }
        if (!crossCurrency && input.toAmountCents !== null) {
          issues.push({
            path: 'toAmountCents',
            message: 'Only transfers between currencies have a destination amount',
          });
        }
      }
    }

    const previousCategoryIds = new Set(
      previous ? [previous.categoryId, ...previous.splits.map((split) => split.categoryId)] : [],
    );
    const checkCategory = (categoryId: string, path: string) => {
      const category = refs.categories.get(categoryId);
      if (!category) issues.push({ path, message: 'Category does not exist' });
      else if (category.kind !== input.type)
        issues.push({ path, message: 'Category is of a different kind' });
      else if (category.archived && !previousCategoryIds.has(categoryId)) {
        issues.push({ path, message: 'Category is archived' });
      }
    };
    // A transfer with a category is already reported by the shape rules above.
    if (input.type !== 'transfer') {
      if (input.categoryId) checkCategory(input.categoryId, 'categoryId');
      input.splits.forEach((split, index) => checkCategory(split.categoryId, `splits.${index}.categoryId`));
    }

    if (input.original && input.original.currency === input.currency) {
      issues.push({
        path: 'original',
        message: 'The original currency must differ from the account currency',
      });
    }

    const tagIds = [...new Set(input.tagIds)];
    if (tagIds.some((tagId) => !refs.tagIds.has(tagId))) {
      issues.push({ path: 'tagIds', message: 'Tag does not exist' });
    }

    if (issues.length > 0 || !account) throw new ValidationError('Invalid transaction', { issues });

    // The rate is never taken as typed: it is whatever links the two amounts.
    const original = input.original
      ? {
          ...input.original,
          rate: impliedRate(input.amountCents, input.original.amountCents) || input.original.rate,
        }
      : null;
    return {
      type: input.type,
      refund: input.refund,
      status,
      source: origin.source,
      date: input.date,
      paymentDate: resolvePaymentDate({
        date: input.date,
        accountType: account.type,
        requested: input.paymentDate,
        periodDueDate:
          account.type === 'credit_card' ? dueDateFor(refs.periods.get(account.id) ?? [], input.date) : null,
      }),
      amountCents: input.amountCents,
      currency: input.currency,
      original,
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      toAmountCents: input.toAmountCents,
      categoryId: input.categoryId,
      description: input.description,
      note: input.note,
      tagIds,
      splits: input.splits,
      items: input.items,
      installment: origin.installment === undefined ? (previous?.installment ?? null) : origin.installment,
      documentId: origin.documentId ?? previous?.documentId ?? null,
      // Only a transfer pays a statement: changed into something else, it lets go of it.
      cardPeriodId:
        input.type === 'transfer' ? (origin.cardPeriodId ?? previous?.cardPeriodId ?? null) : null,
      recurringId: previous?.recurringId ?? null,
      edited: previous ? previous.edited || previous.source !== 'manual' : false,
    };
  }

  /**
   * Products are kept in the transaction's currency. When a converted amount
   * changes (a corrected rate) and the products were not sent again, they
   * change in the same proportion.
   */
  function reconvertedItems(previous: Transaction, patch: TransactionUpdate): TransactionItem[] {
    const amountCents = patch.amountCents ?? previous.amountCents;
    const stillConverted = previous.original && patch.original !== null;
    if (!stillConverted || amountCents === previous.amountCents) return previous.items;
    return previous.items.map((item) => ({
      ...item,
      amountCents: scaleCents(item.amountCents, previous.amountCents, amountCents),
    }));
  }

  async function get(id: string): Promise<Transaction> {
    const transaction = await repository.findById(id);
    if (!transaction) throw new NotFoundError('Transaction', id);
    return transaction;
  }

  return {
    get,

    async list(query: TransactionListQuery): Promise<Paginated<Transaction>> {
      const { categoryId, ...rest } = query;
      if (!categoryId) return repository.find(rest);
      // Filtering by a category includes everything filed under its subcategories.
      const categories = await deps.listCategories();
      return repository.find({
        ...rest,
        categoryIds: [categoryId, ...descendantIds(categoryId, categories)],
      });
    },

    async create(input: TransactionCreate): Promise<Transaction> {
      const record = prepare(input, await loadReferences(), { source: 'manual' });
      const [created] = await repository.insertMany([record]);
      return created!;
    },

    /** The transfer that pays a card statement, linked to it. */
    async createCardPayment(input: TransactionCreate, cardPeriodId: string): Promise<Transaction> {
      const record = prepare(input, await loadReferences(), { source: 'manual', cardPeriodId });
      const [created] = await repository.insertMany([record]);
      return created!;
    },

    /** What was paid towards each of those statements, in the card's currency. */
    paidByCardPeriod: (cardPeriodIds: readonly string[]) => repository.sumPaymentsByPeriod(cardPeriodIds),

    /** A statement is going away: its payments stay as plain transfers. */
    releaseCardPeriod: (cardPeriodId: string, options: WriteOptions) =>
      repository.clearCardPeriod(cardPeriodId, options),

    /** All-or-nothing bulk insert, validated row by row. Used by the import and by documents. */
    async createMany(
      entries: readonly BulkEntry[],
      source: TransactionSource,
      options: WriteOptions,
    ): Promise<number> {
      const refs = await loadReferences(options);
      const records = entries.map((entry, index) => {
        try {
          return prepare(entry.input, refs, {
            source,
            installment: entry.installment,
            documentId: entry.documentId,
            status: entry.status,
          });
        } catch (error) {
          if (error instanceof ValidationError) {
            throw new ValidationError(`Invalid transaction at position ${index + 1}`, {
              index,
              cause: error.details,
            });
          }
          throw error;
        }
      });
      await repository.insertMany(records, options);
      return records.length;
    },

    async update(id: string, patch: TransactionUpdate): Promise<Transaction> {
      const previous = await get(id);
      if (previous.deletedAt) throw new NotFoundError('Transaction', id);
      const movedInTime = patch.date !== undefined || patch.accountId !== undefined;
      const merged: TransactionCreate = {
        type: patch.type ?? previous.type,
        refund: patch.refund ?? previous.refund,
        date: patch.date ?? previous.date,
        amountCents: patch.amountCents ?? previous.amountCents,
        currency: patch.currency ?? previous.currency,
        accountId: patch.accountId ?? previous.accountId,
        categoryId: patch.categoryId === undefined ? previous.categoryId : patch.categoryId,
        description: patch.description ?? previous.description,
        note: patch.note ?? previous.note,
        tagIds: patch.tagIds ?? previous.tagIds,
        splits: patch.splits ?? previous.splits,
        toAccountId: patch.toAccountId === undefined ? previous.toAccountId : patch.toAccountId,
        toAmountCents: patch.toAmountCents === undefined ? previous.toAmountCents : patch.toAmountCents,
        original: patch.original === undefined ? previous.original : patch.original,
        items: patch.items ?? reconvertedItems(previous, patch),
        // A moved transaction gets its payment date worked out again unless one is given.
        paymentDate:
          patch.paymentDate !== undefined ? patch.paymentDate : movedInTime ? null : previous.paymentDate,
      };
      const record = prepare(merged, await loadReferences(), { source: previous.source }, previous);
      const updated = await repository.replace(id, record);
      if (!updated) throw new NotFoundError('Transaction', id);
      return updated;
    },

    /** Moves the transaction to the trash, where it stays TRASH_RETENTION_DAYS. */
    async remove(id: string): Promise<void> {
      if (!(await repository.setDeleted(id, deps.now()))) throw new NotFoundError('Transaction', id);
    },

    async restore(id: string): Promise<Transaction> {
      if (!(await repository.setDeleted(id, null))) throw new NotFoundError('Transaction', id);
      return get(id);
    },

    /** Deletes for good a transaction that is already in the trash. There is no way back. */
    async removeForever(id: string): Promise<void> {
      if (!(await repository.deleteTrashed(id))) throw new NotFoundError('Transaction', id);
    },

    /** Deletes for good everything in the trash, and says how many there were. */
    emptyTrash(now: Date = deps.now()): Promise<number> {
      return repository.purgeDeletedBefore(shiftMoment(now, MS_PER_SECOND));
    },

    /**
     * Works out again when each purchase of a card is paid, after its
     * statement dates changed. A purchase no statement covers any more goes
     * back to its own date if it was on one of the due dates that went away.
     */
    async refreshPaymentDates(
      accountId: string,
      staleDueDates: readonly string[],
      options: WriteOptions = {},
    ): Promise<number> {
      const refs = await loadReferences(options);
      const account = refs.accounts.get(accountId);
      if (account?.type !== 'credit_card') return 0;
      const periods = refs.periods.get(accountId) ?? [];
      const updates = (await repository.findPaymentDates(accountId)).flatMap((row) => {
        const due = dueDateFor(periods, row.date);
        const paymentDate = due ?? (staleDueDates.includes(row.paymentDate) ? row.date : row.paymentDate);
        return paymentDate === row.paymentDate ? [] : [{ id: row.id, paymentDate }];
      });
      await repository.setPaymentDates(updates, options);
      return updates.length;
    },

    /** What each live purchase or credit of an account adds to its bill. */
    listCharges: (accountId: string) => repository.findCharges(accountId),

    /** Future installments become real when their day comes. Run daily and at startup. */
    confirmDue: (): Promise<number> => repository.confirmProjectedUpTo(deps.today()),

    trashByPlan: (planId: string, options: WriteOptions = {}) =>
      repository.trashByPlan(planId, deps.now(), options),

    purgeTrash(now: Date = deps.now()): Promise<number> {
      const cutoff = shiftMoment(now, -TRASH_RETENTION_DAYS * MS_PER_DAY);
      return repository.purgeDeletedBefore(cutoff);
    },

    async summary(month: string): Promise<MonthSummary> {
      return { month, totals: await repository.totalsByMonth(month) };
    },

    /** What the reports and the fixed items read of the transactions paid in a range of days. */
    listReportRows: (range: { from: string; to: string }) => repository.findReportRows(range),

    /**
     * What an account's confirmed movements add to its balance between two
     * days: income and what reaches it add, expenses and what leaves it take
     * away. A refund gives back what its purchase took.
     */
    async netMovement(accountId: string, range: { from: string | null; to: string }): Promise<number> {
      let net = 0;
      for (const move of await repository.findAccountMoves(accountId, range)) {
        if (move.accountId === accountId) {
          if (move.type === 'income') net += move.amountCents;
          else net -= move.type === 'expense' ? spendingCents(move) : move.amountCents;
        }
        if (move.type === 'transfer' && move.toAccountId === accountId)
          net += move.toAmountCents ?? move.amountCents;
      }
      return net;
    },

    /** Marks a transaction as one of a fixed item's (null takes the mark away). */
    async markRecurring(id: string, recurringId: string | null, options: WriteOptions = {}): Promise<void> {
      await get(id);
      await repository.setRecurring(id, recurringId, options);
    },

    releaseRecurring: (recurringId: string, options: WriteOptions) =>
      repository.clearRecurring(recurringId, options),

    /** What each income or expense paid in a month adds to its category, for the report by category. */
    listFiled: (month: string) => repository.findFiledByMonth(month),

    /** Receipt lines of the confirmed expenses in a date range, for the consumption report. */
    listItems: (range: { from?: string; to?: string }) => repository.findItems(range),

    /** Where the next conversion from a foreign currency starts: the last rate the user applied. */
    lastRate: (currency: string): Promise<LastRate> => repository.findLastRate(currency),

    listForExport: (range: { from?: string; to?: string }) => repository.findAllForExport(range),

    /** Tells which candidates match an existing transaction by date, amount and account. */
    async findDuplicates(
      candidates: readonly { date: string; amountCents: number; accountId: string }[],
    ): Promise<boolean[]> {
      if (candidates.length === 0) return [];
      const dates = candidates.map((candidate) => candidate.date).sort();
      const keys = await repository.duplicateKeys({
        from: dates[0]!,
        to: dates[dates.length - 1]!,
        accountIds: [...new Set(candidates.map((candidate) => candidate.accountId))],
      });
      return candidates.map((candidate) =>
        keys.has(duplicateKey(candidate.date, candidate.amountCents, candidate.accountId)),
      );
    },

    // What other modules may ask about transactions.
    countByAccount: (accountId: string) => repository.countByAccount(accountId),
    countByCategory: (categoryId: string) => repository.countByCategory(categoryId),
    /**
     * Everything filed under one category goes to another (they are being
     * merged). A divided transaction with a part in each ends up with two parts
     * in the same category: those become one.
     */
    async moveCategory(fromId: string, toId: string, options: WriteOptions): Promise<void> {
      await repository.moveCategory(fromId, toId, options);
      for (const divided of await repository.findDividedBy(toId, options)) {
        const filing = joinSameCategory(divided.splits);
        if (filing) await repository.setFiling(divided.id, filing, options);
      }
    },
    removeTag: (tagId: string, options: WriteOptions) => repository.pullTag(tagId, options),
    /**
     * For each candidate, whether a stored transaction has the same day and
     * amount in the same currency. The account is not compared: a receipt
     * being reviewed may not have one yet.
     */
    async findSameDayAmounts(
      candidates: readonly { date: string; amountCents: number; currency: string }[],
    ): Promise<boolean[]> {
      const keys = await repository.amountKeysOn([...new Set(candidates.map((candidate) => candidate.date))]);
      return candidates.map((candidate) =>
        keys.has(duplicateKey(candidate.date, candidate.amountCents, candidate.currency)),
      );
    },

    /** For each candidate, whether a live transaction is already that installment of that amount. */
    async findInstallments(
      candidates: readonly { number: number; total: number; amountCents: number; currency: string }[],
    ): Promise<boolean[]> {
      const keys = await repository.installmentKeys([
        ...new Set(candidates.map((candidate) => candidate.amountCents)),
      ]);
      return candidates.map((candidate) =>
        keys.has(installmentKey(candidate, candidate.amountCents, candidate.currency)),
      );
    },

    countLiveByDocument: (documentId: string) => repository.countLiveByDocument(documentId),
    /** The document is going away but its transactions stay, as if entered by hand. */
    releaseDocument: (documentId: string, options: WriteOptions) =>
      repository.releaseDocument(documentId, options),
    /** The document is going away and takes its transactions to the trash. */
    trashByDocument: (documentId: string, options: WriteOptions) =>
      repository.trashByDocument(documentId, deps.now(), options),
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
