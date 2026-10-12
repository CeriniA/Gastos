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
  return {
    countByAccount: (accountId: string) => repository.countByAccount(accountId),

    async create(input: InstallmentPlanCreate): Promise<InstallmentPlanResult> {
      const purchase = input.transaction;
      if (purchase.type !== 'expense')
        throw fieldError('transaction.type', 'Only purchases go in installments');
      if (purchase.splits.length > 0) {
        throw fieldError('transaction.splits', 'A purchase in installments cannot be split');
      }
      const account = (await deps.listAccounts()).find((candidate) => candidate.id === purchase.accountId);
      if (account?.type !== 'credit_card') {
        throw fieldError('transaction.accountId', 'Installments are for credit cards');
      }

      const today = deps.today();
      const amounts = splitInstallments(purchase.amountCents, input.installments);
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
          const date = addMonths(purchase.date, index);
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
            status: (date <= today ? 'confirmed' : 'projected') as TransactionStatus,
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
