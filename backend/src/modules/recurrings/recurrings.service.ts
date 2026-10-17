import {
  RECURRING_GRACE_DAYS,
  RECURRING_LOOKBACK_MONTHS,
  RECURRING_MIN_MONTHS,
  RECURRING_TOLERANCE,
  TEXT_LIMITS,
  addDays,
  addMonthsToKey,
  dayInMonth,
  dayOfMonth,
  firstDayOfMonth,
  isNear,
  lastDayOfMonth,
  monthKeyOf,
  nameKey,
  sumCents,
  type Account,
  type Category,
  type IsoDate,
  type MonthKey,
  type ProjectedEntry,
  type Recurring,
  type RecurringFromTransaction,
  type RecurringMonth,
  type RecurringOverview,
  type RecurringState,
  type RecurringSuggestion,
  type RecurringUpdate,
  type ReportRow,
  type Transaction,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { DuplicateError, NotFoundError, fieldError } from '../../core/errors/errors';
import type { RecurringsRepository } from './recurrings.repository';

/** What this module needs from the rest of the app. */
export interface RecurringDependencies {
  /** Live transactions paid in a range of days, the projected ones included. */
  listRows(range: { from: IsoDate; to: IsoDate }): Promise<ReportRow[]>;
  findTransaction(id: string): Promise<Transaction>;
  listAccounts(): Promise<Account[]>;
  listCategories(): Promise<Category[]>;
  /** Marks a transaction as one of a fixed item's, or (null) takes the mark away. */
  markTransaction(transactionId: string, recurringId: string | null, options: WriteOptions): Promise<void>;
  /** Every transaction marked with a fixed item loses the mark; the transactions stay. */
  releaseTransactions(recurringId: string, options: WriteOptions): Promise<void>;
  today(): IsoDate;
  runInTransaction: TransactionRunner;
}

/**
 * Whether a transaction is one of a fixed item's: marked with it, or (when it
 * is marked with none) an income or expense of the same kind and currency
 * whose description is the item's merchant. Refunds and installments to come are not.
 */
function belongsTo(recurring: Recurring, row: ReportRow): boolean {
  if (row.status !== 'confirmed' || row.refund) return false;
  if (row.recurringId !== null) return row.recurringId === recurring.id;
  return (
    recurring.merchantKey !== '' &&
    row.type === recurring.type &&
    row.currency === recurring.currency &&
    nameKey(row.description) === recurring.merchantKey
  );
}

/**
 * How a fixed item stands in a month, counted like the balance: by the day
 * each transaction is paid. Nothing arrived and its day (plus a few days of
 * grace) went by: it is late.
 */
function monthOf(
  recurring: Recurring,
  rows: readonly ReportRow[],
  month: MonthKey,
  today: IsoDate,
): RecurringMonth {
  const expectedDate = dayInMonth(month, recurring.dayOfMonth);
  const arrived = rows.filter((row) => monthKeyOf(row.paymentDate) === month && belongsTo(recurring, row));
  const seenCents = sumCents(arrived.map((row) => row.amountCents));
  let state: RecurringState;
  if (!recurring.active) state = 'paused';
  else if (arrived.length > 0)
    state = isNear(seenCents, recurring.expectedAmountCents, RECURRING_TOLERANCE) ? 'seen' : 'changed';
  else state = addDays(expectedDate, RECURRING_GRACE_DAYS) < today ? 'late' : 'expected';
  return { recurring, state, seenCents, expectedDate, transactionIds: arrived.map((row) => row.id) };
}

/**
 * Merchants that look fixed: paid exactly once in each of several months in a
 * row, for about the same amount as the latest time. The run ends in `month`,
 * or in the month before (this month's may still be on its way). Merchants
 * that already are a fixed item, or that the user said are not, are left out.
 */
function suggestionsFor(
  rows: readonly ReportRow[],
  recurrings: readonly Recurring[],
  month: MonthKey,
): RecurringSuggestion[] {
  const known = new Set(recurrings.map((recurring) => recurring.merchantKey));
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = nameKey(row.description);
    const candidate =
      row.status === 'confirmed' &&
      row.type !== 'transfer' &&
      !row.refund &&
      row.installment === null &&
      row.recurringId === null &&
      key !== '' &&
      !known.has(key);
    if (!candidate) continue;
    const group = `${row.type}|${row.currency}|${key}`;
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }

  const suggestions: RecurringSuggestion[] = [];
  for (const group of groups.values()) {
    const byMonth = new Map<MonthKey, ReportRow[]>();
    for (const row of group) {
      const paid = monthKeyOf(row.paymentDate);
      byMonth.set(paid, [...(byMonth.get(paid) ?? []), row]);
    }
    let cursor = byMonth.has(month) ? month : addMonthsToKey(month, -1);
    const latest = byMonth.get(cursor)?.[0];
    if (!latest) continue;
    let run = 0;
    for (;;) {
      const paid = byMonth.get(cursor);
      if (paid?.length !== 1 || !isNear(paid[0]!.amountCents, latest.amountCents, RECURRING_TOLERANCE)) break;
      run += 1;
      cursor = addMonthsToKey(cursor, -1);
    }
    if (run < RECURRING_MIN_MONTHS || latest.type === 'transfer') continue;
    suggestions.push({
      transactionId: latest.id,
      name: latest.description,
      type: latest.type,
      amountCents: latest.amountCents,
      currency: latest.currency,
      months: run,
    });
  }
  return suggestions.sort((a, b) => a.name.localeCompare(b.name));
}

export function createRecurringsService(repository: RecurringsRepository, deps: RecurringDependencies) {
  async function get(id: string): Promise<Recurring> {
    const recurring = await repository.findById(id);
    if (!recurring) throw new NotFoundError('Recurring', id);
    return recurring;
  }

  /** The months a look at `month` needs: those suggestions are looked for in, ending in it. */
  function rowsUpTo(month: MonthKey): Promise<ReportRow[]> {
    return deps.listRows({
      from: firstDayOfMonth(addMonthsToKey(month, 1 - RECURRING_LOOKBACK_MONTHS)),
      to: lastDayOfMonth(month),
    });
  }

  async function checkName(name: string, ownId?: string): Promise<string> {
    const key = nameKey(name);
    const holder = await repository.findByNameKey(key);
    if (holder && holder.id !== ownId) throw new DuplicateError('Recurring', 'name');
    return key;
  }

  return {
    /** Every fixed item and how it stands in a month (this one by default), plus what looks fixed. */
    async overview(month: MonthKey = monthKeyOf(deps.today())): Promise<RecurringOverview> {
      const [recurrings, rows] = await Promise.all([repository.findAll(), rowsUpTo(month)]);
      const today = deps.today();
      return {
        month,
        items: recurrings
          .filter((recurring) => !recurring.ignored)
          .map((recurring) => monthOf(recurring, rows, month, today)),
        suggestions: suggestionsFor(rows, recurrings, month),
        ignored: recurrings.filter((recurring) => recurring.ignored),
      };
    },

    /**
     * What the fixed items still bring to a month, for the projection: every
     * active one, except those that already arrived in it.
     */
    async expected(month: MonthKey): Promise<ProjectedEntry[]> {
      const [recurrings, rows] = await Promise.all([
        repository.findAll(),
        deps.listRows({ from: firstDayOfMonth(month), to: lastDayOfMonth(month) }),
      ]);
      const today = deps.today();
      return recurrings
        .filter((recurring) => recurring.active && !recurring.ignored)
        .map((recurring) => monthOf(recurring, rows, month, today))
        .filter((item) => item.state === 'expected' || item.state === 'late')
        .map(({ recurring, expectedDate }) => ({
          kind: 'recurring' as const,
          type: recurring.type,
          name: recurring.name,
          installment: null,
          date: expectedDate,
          cents: recurring.expectedAmountCents,
          currency: recurring.currency,
        }));
    },

    /**
     * Marks a transaction as fixed: a new fixed item made from it, expected
     * on the day it was paid, for its amount. If its merchant already is one,
     * the transaction joins it. With `ignore`, the merchant is remembered as
     * not fixed instead, so it is not suggested again.
     */
    async fromTransaction(input: RecurringFromTransaction): Promise<Recurring> {
      const transaction = await deps.findTransaction(input.transactionId);
      const { type } = transaction;
      if (type === 'transfer') throw fieldError('transactionId', 'Only an income or an expense can be fixed');
      const merchantKey = nameKey(transaction.description);
      if (merchantKey === '')
        throw fieldError('transactionId', 'Give the transaction a description to mark it as fixed');

      const existing = (await repository.findAll()).find(
        (recurring) =>
          recurring.merchantKey === merchantKey &&
          recurring.type === type &&
          recurring.currency === transaction.currency,
      );
      return deps.runInTransaction(async (session) => {
        const options = { session };
        if (existing) {
          const updated = await repository.update(
            existing.id,
            input.ignore ? { ignored: true, active: false } : { ignored: false, active: true },
            options,
          );
          if (!input.ignore) await deps.markTransaction(transaction.id, existing.id, options);
          return updated ?? existing;
        }
        const name = transaction.description.trim().slice(0, TEXT_LIMITS.name);
        const recurring = await repository.create(
          {
            name,
            nameKey: await checkName(name),
            type,
            expectedAmountCents: transaction.amountCents,
            currency: transaction.currency,
            accountId: transaction.accountId,
            categoryId: transaction.categoryId,
            dayOfMonth: dayOfMonth(transaction.paymentDate),
            active: !input.ignore,
            ignored: input.ignore,
            merchantKey,
          },
          options,
        );
        if (!input.ignore) await deps.markTransaction(transaction.id, recurring.id, options);
        return recurring;
      });
    },

    /** Its name, expected amount and day, account, category, or whether it is paused. */
    async update(id: string, changes: RecurringUpdate): Promise<Recurring> {
      const current = await get(id);
      const record: Parameters<RecurringsRepository['update']>[1] = { ...changes };
      if (changes.name !== undefined) record.nameKey = await checkName(changes.name, id);
      if (changes.accountId !== undefined) {
        const account = (await deps.listAccounts()).find((candidate) => candidate.id === changes.accountId);
        if (!account) throw fieldError('accountId', 'Account does not exist');
        if (account.archived) throw fieldError('accountId', 'Account is archived');
        // A fixed item is in its account's currency, like a transaction.
        record.currency = account.currency;
      }
      if (changes.categoryId) {
        const category = (await deps.listCategories()).find(
          (candidate) => candidate.id === changes.categoryId,
        );
        if (!category) throw fieldError('categoryId', 'Category does not exist');
        if (category.archived && category.id !== current.categoryId)
          throw fieldError('categoryId', 'Category is archived');
        if (category.kind !== current.type) throw fieldError('categoryId', 'Category is of a different kind');
      }
      const updated = await repository.update(id, record);
      if (!updated) throw new NotFoundError('Recurring', id);
      return updated;
    },

    /** Deleting a fixed item only takes the mark off its transactions; they stay. */
    async remove(id: string): Promise<void> {
      await get(id);
      await deps.runInTransaction(async (session) => {
        await deps.releaseTransactions(id, { session });
        await repository.delete(id, { session });
      });
    },

    countByAccount: (accountId: string) => repository.countByAccount(accountId),
    moveCategory: (fromId: string, toId: string, options: WriteOptions) =>
      repository.moveCategory(fromId, toId, options),
    clearCategory: (categoryId: string, options: WriteOptions) =>
      repository.clearCategory(categoryId, options),
  };
}

export type RecurringsService = ReturnType<typeof createRecurringsService>;
