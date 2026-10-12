import type {
  Account,
  CardPeriod,
  CardPeriodCreate,
  CardPeriodUpdate,
  CardPeriodView,
  CardStatement,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { DuplicateError, NotFoundError, fieldError } from '../../core/errors/errors';
import type { CardPeriodsRepository } from './cardPeriods.repository';

/** What the card periods need from the rest of the app. */
export interface CardPeriodDependencies {
  listAccounts(): Promise<Account[]>;
  /** Re-assigns the payment date of the card's purchases after its statement dates changed. */
  refreshPaymentDates(
    accountId: string,
    staleDueDates: readonly string[],
    options: WriteOptions,
  ): Promise<number>;
  /** Live purchases (positive) and credits (negative) of an account, with their dates. */
  listCharges(accountId: string): Promise<{ date: string; paymentDate: string; signedCents: number }[]>;
  runInTransaction: TransactionRunner;
}

/**
 * Credit card statements: their closing and due dates decide when each card
 * purchase is paid, which is what the monthly balance is built on.
 */
export function createCardPeriodsService(repository: CardPeriodsRepository, deps: CardPeriodDependencies) {
  async function get(id: string): Promise<CardPeriod> {
    const period = await repository.findById(id);
    if (!period) throw new NotFoundError('CardPeriod', id);
    return period;
  }

  async function assertCard(accountId: string): Promise<Account> {
    const account = (await deps.listAccounts()).find((candidate) => candidate.id === accountId);
    if (!account || account.type !== 'credit_card')
      throw fieldError('accountIds', 'Account is not a credit card');
    return account;
  }

  /** One closing day per card: two statements cannot close the same day. */
  async function assertClosingFree(accountId: string, closingDate: string, exceptId?: string) {
    const taken = (await repository.findByAccount(accountId)).some(
      (period) => period.closingDate === closingDate && period.id !== exceptId,
    );
    if (taken) throw new DuplicateError('CardPeriod', 'closingDate');
  }

  /**
   * Checks every period before writing any, then stores them and moves each
   * card's purchases to their new payment dates.
   */
  async function insert(
    inputs: readonly CardPeriodCreate[],
    documentId: string | null,
    options: WriteOptions,
  ): Promise<CardPeriod[]> {
    const rows = inputs.flatMap(({ accountIds, ...data }) =>
      [...new Set(accountIds)].map((accountId) => ({ accountId, data })),
    );
    const seen = new Set<string>();
    for (const { accountId, data } of rows) {
      await assertCard(accountId);
      await assertClosingFree(accountId, data.closingDate);
      const key = `${accountId}|${data.closingDate}`;
      if (seen.has(key)) throw new DuplicateError('CardPeriod', 'closingDate');
      seen.add(key);
    }
    const created: CardPeriod[] = [];
    for (const { accountId, data } of rows)
      created.push(await repository.create(accountId, { ...data, documentId }, options));
    for (const accountId of new Set(rows.map((row) => row.accountId)))
      await deps.refreshPaymentDates(accountId, [], options);
    return created;
  }

  return {
    /** Closing and due dates of every card, for the transactions module. */
    async listDates(options: WriteOptions = {}) {
      return (await repository.findAll(options)).map(({ accountId, closingDate, dueDate }) => ({
        accountId,
        closingDate,
        dueDate,
      }));
    },

    countByAccount: (accountId: string) => repository.countByAccount(accountId),

    /** A card's statements, newest first, with what the app has charged to each. */
    async statement(accountId: string): Promise<CardStatement> {
      await assertCard(accountId);
      const [periods, charges] = await Promise.all([
        repository.findByAccount(accountId),
        deps.listCharges(accountId),
      ]);
      const views: CardPeriodView[] = periods.map((period) => {
        const own = charges.filter((charge) => charge.paymentDate === period.dueDate);
        return {
          ...period,
          chargedCents: own.reduce((sum, charge) => sum + charge.signedCents, 0),
          transactionCount: own.length,
        };
      });
      const lastClosing = periods[0]?.closingDate ?? null;
      const open = charges.filter((charge) => !lastClosing || charge.date > lastClosing);
      return {
        accountId,
        periods: views,
        open: {
          since: lastClosing,
          chargedCents: open.reduce((sum, charge) => sum + charge.signedCents, 0),
          transactionCount: open.length,
        },
      };
    },

    /** The same dates for one or more cards (a card in pesos and in dollars), all or none. */
    create(input: CardPeriodCreate): Promise<CardPeriod[]> {
      return deps.runInTransaction((session) => insert([input], null, { session }));
    },

    /** Dates read from a card statement, inside the transaction that confirms it. */
    createFromDocument(
      inputs: readonly CardPeriodCreate[],
      documentId: string,
      options: WriteOptions,
    ): Promise<CardPeriod[]> {
      return insert(inputs, documentId, options);
    },

    /** The periods read from a document that is being deleted keep their dates, without the link. */
    releaseDocument: (documentId: string, options: WriteOptions) =>
      repository.clearDocument(documentId, options),

    async update(id: string, input: CardPeriodUpdate): Promise<CardPeriod> {
      const current = await get(id);
      const closingDate = input.closingDate ?? current.closingDate;
      const dueDate = input.dueDate ?? current.dueDate;
      if (dueDate <= closingDate) throw fieldError('dueDate', 'The due date must be after the closing date');
      if (input.closingDate !== undefined) await assertClosingFree(current.accountId, closingDate, id);
      return deps.runInTransaction(async (session) => {
        const updated = await repository.update(id, input, { session });
        if (!updated) throw new NotFoundError('CardPeriod', id);
        await deps.refreshPaymentDates(current.accountId, [current.dueDate], { session });
        return updated;
      });
    },

    async remove(id: string): Promise<void> {
      const current = await get(id);
      await deps.runInTransaction(async (session) => {
        await repository.delete(id, { session });
        await deps.refreshPaymentDates(current.accountId, [current.dueDate], { session });
      });
    },
  };
}

export type CardPeriodsService = ReturnType<typeof createCardPeriodsService>;
