import {
  addMonths,
  splitInstallments,
  type Account,
  type InstallmentPlan,
  type InstallmentPlanCreate,
  type InstallmentPlanResult,
  type IsoDate,
  type TransactionCreate,
  type TransactionStatus,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { NotFoundError, fieldError } from '../../core/errors/errors';
import { datesAfterClosing, installmentDates } from './installmentDates';
import type { InstallmentPlansRepository } from './installmentPlans.repository';

/** What installment plans need from the rest of the app. */
export interface InstallmentPlanDependencies {
  listAccounts(): Promise<Account[]>;
  /** Stores the installments, all or none, validated like any other transaction. */
  createTransactions(
    entries: readonly {
      input: TransactionCreate;
      installment: { planId: string; number: number; total: number };
      status: TransactionStatus;
    }[],
    options: WriteOptions,
  ): Promise<number>;
  trashTransactions(planId: string, options: WriteOptions): Promise<number>;
  /** Closing dates of a card's statements, which decide when each installment is charged. */
  listClosingDates(accountId: string): Promise<IsoDate[]>;
  today(): IsoDate;
  runInTransaction: TransactionRunner;
}

/**
 * A card purchase in installments becomes one transaction per month. Those
 * already due are confirmed; the rest are projected and become confirmed on
 * their own day, so each month's balance only counts what it pays.
 */
export function createInstallmentPlansService(
  repository: InstallmentPlansRepository,
  deps: InstallmentPlanDependencies,
) {
  /** The rules every purchase in installments follows, however it arrives. */
  async function assertPlannable(purchase: TransactionCreate): Promise<void> {
    if (purchase.type !== 'expense')
      throw fieldError('transaction.type', 'Only purchases go in installments');
    if (purchase.refund) throw fieldError('transaction.refund', 'A refund is not paid in installments');
    if (purchase.splits.length > 0) {
      throw fieldError('transaction.splits', 'A purchase in installments cannot be split');
    }
    const account = (await deps.listAccounts()).find((candidate) => candidate.id === purchase.accountId);
    if (account?.type !== 'credit_card') {
      throw fieldError('transaction.accountId', 'Installments are for credit cards');
    }
  }

  const statusOn = (date: IsoDate): TransactionStatus => (date <= deps.today() ? 'confirmed' : 'projected');

  return {
    countByAccount: (accountId: string) => repository.countByAccount(accountId),

    /**
     * A statement charges installment `number` of `total` of a purchase the
     * app does not have. Creates its plan and the installments still to come,
     * each for the same amount; returns the plan, for the caller to link the
     * installment it stores itself. The earlier ones were paid before and are
     * not created. Runs inside the caller's database transaction.
     */
    async continueFromStatement(
      input: { transaction: TransactionCreate; number: number; total: number },
      options: WriteOptions,
    ): Promise<InstallmentPlan> {
      const charged = input.transaction;
      await assertPlannable(charged);
      if (input.number >= input.total)
        throw fieldError('installment', 'There are no installments left to create');

      const plan = await repository.create(
        {
          accountId: charged.accountId,
          description: charged.description,
          // Approximate: the statement charges this one `number - 1` months after the purchase.
          purchaseDate: addMonths(charged.date, 1 - input.number),
          totalAmountCents: charged.amountCents * input.total,
          currency: charged.currency,
          installments: input.total,
        },
        options,
      );
      // The statement charged this one on its closing day: the rest follow it, one per statement.
      const entries = datesAfterClosing(charged.date, input.total - input.number).map((date, index) => {
        return {
          input: { ...charged, date, paymentDate: null, items: [] },
          installment: { planId: plan.id, number: input.number + index + 1, total: input.total },
          status: statusOn(date),
        };
      });
      await deps.createTransactions(entries, options);
      return plan;
    },

    async create(input: InstallmentPlanCreate): Promise<InstallmentPlanResult> {
      const purchase = input.transaction;
      await assertPlannable(purchase);

      const amounts = splitInstallments(purchase.amountCents, input.installments);
      const dates = installmentDates(
        purchase.date,
        input.installments,
        await deps.listClosingDates(purchase.accountId),
      );
      return deps.runInTransaction(async (session) => {
        const plan: InstallmentPlan = await repository.create(
          {
            accountId: purchase.accountId,
            description: purchase.description,
            purchaseDate: purchase.date,
            totalAmountCents: purchase.amountCents,
            currency: purchase.currency,
            installments: input.installments,
          },
          { session },
        );
        const entries = amounts.map((amountCents, index) => {
          const date = dates[index]!;
          return {
            input: {
              ...purchase,
              date,
              amountCents,
              // The card decides the payment date of each installment.
              paymentDate: null,
              // What was bought is listed once, on the first installment.
              items: index === 0 ? purchase.items : [],
            },
            installment: { planId: plan.id, number: index + 1, total: input.installments },
            status: statusOn(date),
          };
        });
        await deps.createTransactions(entries, { session });
        const confirmed = entries.filter((entry) => entry.status === 'confirmed').length;
        return { plan, confirmed, projected: entries.length - confirmed };
      });
    },

    /** Sends every installment to the trash. The plan stays, so a restored installment still points at it. */
    async remove(id: string): Promise<number> {
      if (!(await repository.findById(id))) throw new NotFoundError('InstallmentPlan', id);
      return deps.runInTransaction((session) => deps.trashTransactions(id, { session }));
    },
  };
}

export type InstallmentPlansService = ReturnType<typeof createInstallmentPlansService>;
