import { z } from 'zod';
import { MAX_INSTALLMENTS, type Currency } from '../constants';
import { transactionCreateSchema } from './transaction';

/** The plans offered on screen: the usual ones of Argentine cards. 1 is a single payment. */
export const INSTALLMENT_CHOICES = [1, 2, 3, 4, 6, 9, 12, 18, 24] as const;

/**
 * A purchase paid in installments. `transaction` is the purchase as a whole
 * (its amount is the total); the app turns it into one transaction per month.
 */
export const installmentPlanCreateSchema = z.object({
  transaction: transactionCreateSchema,
  installments: z.number().int().min(2).max(MAX_INSTALLMENTS),
});
export type InstallmentPlanCreate = z.infer<typeof installmentPlanCreateSchema>;

export interface InstallmentPlan {
  id: string;
  accountId: string;
  description: string;
  purchaseDate: string;
  /** Total of the purchase. Each installment's real amount lives on its transaction. */
  totalAmountCents: number;
  currency: Currency;
  installments: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPlanResult {
  plan: InstallmentPlan;
  /** How many of the installments are already due (confirmed); the rest are projected. */
  confirmed: number;
  projected: number;
}
