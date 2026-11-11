import {
  MS_PER_DAY,
  MS_PER_SECOND,
  scaleCents,
  shiftMoment,
  spendingCents,
  TRASH_RETENTION_DAYS,
  descendantIds,
  type Account,
  type Category,
  type FiledAmount,
  type Installment,
  type IsoDate,
  type LastRate,
  type Merchant,
  type MonthSummary,
  type Paginated,
  type Product,
  type Tag,
  type Transaction,
  type TransactionCreate,
  type TransactionItem,
  type TransactionListQuery,
  type TransactionSource,
  type TransactionStatus,
  type TransactionUpdate,
  filedAmounts,
} from '@gastos/shared';
import type { WriteOptions } from '../../core/db/transaction';
import { NotFoundError, ValidationError } from '../../core/errors/errors';
import { dueDateFor, type PeriodDates } from './paymentDate';
import { duplicateKey, installmentKey } from './duplicateKey';
import { prepareTransaction, type References } from './prepareTransaction';
import type { TransactionsRepository } from './transactions.repository';

/** What the transactions module needs from the rest of the app. */
export interface TransactionDependencies {
  listAccounts(): Promise<Account[]>;
  listCategories(options?: WriteOptions): Promise<Category[]>;
  listTags(options?: WriteOptions): Promise<Tag[]>;
  listMerchants(options?: WriteOptions): Promise<Merchant[]>;
  listProducts(options?: WriteOptions): Promise<Product[]>;
  /** Closing and due dates of every card statement, which decide when card purchases are paid. */
  listCardPeriods(options?: WriteOptions): Promise<PeriodDates[]>;
  /** Today's calendar day in the app's time zone. */
  today(): IsoDate;
  /** The current moment: when something is sent to the trash and when the trash is old enough to empty. */
  now(): Date;
}

/** One transaction to store in bulk, with what its origin knows about it. */
export interface BulkEntry {
  input: TransactionCreate;
  installment: Installment | null;
  documentId?: string;
  status?: TransactionStatus;
}

export function createTransactionsService(repository: TransactionsRepository, deps: TransactionDependencies) {
  async function loadReferences(options: WriteOptions = {}): Promise<References> {
    const [accounts, categories, tags, merchants, products, periods] = await Promise.all([
      deps.listAccounts(),
      deps.listCategories(options),
      deps.listTags(options),
      deps.listMerchants(options),
      deps.listProducts(options),
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
      merchants: new Map(merchants.map((merchant) => [merchant.id, merchant])),
      products: new Map(products.map((product) => [product.id, product])),
      periods: periodsByAccount,
      today: deps.today(),
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
      const record = prepareTransaction(input, await loadReferences(), { source: 'manual' });
      const [created] = await repository.insertMany([record]);
      return created!;
    },

    /** The transfer that pays a card statement, linked to it. */
    async createCardPayment(input: TransactionCreate, cardPeriodId: string): Promise<Transaction> {
      const record = prepareTransaction(input, await loadReferences(), { source: 'manual', cardPeriodId });
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
          return prepareTransaction(entry.input, refs, {
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
        merchantId: patch.merchantId === undefined ? previous.merchantId : patch.merchantId,
        description: patch.description ?? previous.description,
        note: patch.note ?? previous.note,
        tagIds: patch.tagIds ?? previous.tagIds,
        toAccountId: patch.toAccountId === undefined ? previous.toAccountId : patch.toAccountId,
        toAmountCents: patch.toAmountCents === undefined ? previous.toAmountCents : patch.toAmountCents,
        original: patch.original === undefined ? previous.original : patch.original,
        items: patch.items ?? reconvertedItems(previous, patch),
        // A moved transaction gets its payment date worked out again unless one is given.
        paymentDate:
          patch.paymentDate !== undefined ? patch.paymentDate : movedInTime ? null : previous.paymentDate,
      };
      const record = prepareTransaction(merged, await loadReferences(), { source: previous.source }, previous);
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
    listFiled: async (month: string): Promise<FiledAmount[]> => {
      const productCategories = new Map((await deps.listProducts()).map((product) => [product.id, product.categoryId]));
      return (await repository.findFilableByMonth(month)).flatMap((row) => filedAmounts(row, productCategories));
    },

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
    /** Everything filed under one category goes to another (they are being merged). */
    moveCategory: (fromId: string, toId: string, options: WriteOptions) =>
      repository.moveCategory(fromId, toId, options),
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
