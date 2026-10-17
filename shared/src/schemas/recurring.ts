import { z } from 'zod';
import { MAX_DAY_OF_MONTH, type CategoryKind, type Currency, type RecurringState } from '../constants';
import type { IsoDate, MonthKey } from '../dates';
import { amountCentsSchema, monthKeySchema, nameSchema, objectIdSchema } from './common';

/**
 * A fixed income or expense (rent, a subscription, the salary): expected
 * every month, for about the same amount. The app suggests them; only the
 * user marks one. A fixed item is recognised in a month by the transactions
 * marked with it and by those with its merchant's description.
 */
export interface Recurring {
  id: string;
  name: string;
  type: CategoryKind;
  expectedAmountCents: number;
  currency: Currency;
  accountId: string;
  categoryId: string | null;
  /** The day of the month it is usually paid; short months use their last day. */
  dayOfMonth: number;
  /** A paused item is not expected, nor projected, nor warned about. */
  active: boolean;
  /**
   * The user said this merchant is not fixed: it is never suggested again.
   * Kept as an item so the decision is remembered and can be undone.
   */
  ignored: boolean;
  /** The description, normalised, its transactions are recognised by. */
  merchantKey: string;
  createdAt: string;
  updatedAt: string;
}

/** Marks a transaction as fixed, or says its merchant is not, from a suggestion or by hand. */
export const recurringFromTransactionSchema = z.object({
  transactionId: objectIdSchema,
  ignore: z.boolean().default(false),
});
export type RecurringFromTransaction = z.infer<typeof recurringFromTransactionSchema>;

export const recurringUpdateSchema = z
  .object({
    name: nameSchema,
    expectedAmountCents: amountCentsSchema,
    dayOfMonth: z.number().int().min(1).max(MAX_DAY_OF_MONTH),
    accountId: objectIdSchema,
    categoryId: objectIdSchema.nullable(),
    active: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to change' });
export type RecurringUpdate = z.infer<typeof recurringUpdateSchema>;

export const recurringOverviewQuerySchema = z.object({ month: monthKeySchema.optional() });

/** A fixed item in one month. */
export interface RecurringMonth {
  recurring: Recurring;
  state: RecurringState;
  /** What arrived in the month: the transactions recognised as it, added up. */
  seenCents: number;
  /** The day it is expected in that month. */
  expectedDate: IsoDate;
  transactionIds: string[];
}

/** A merchant that looks fixed: once a month, for about the same amount, several months in a row. */
export interface RecurringSuggestion {
  /** The latest of its transactions; marking it creates the fixed item. */
  transactionId: string;
  name: string;
  type: CategoryKind;
  amountCents: number;
  currency: Currency;
  /** Months in a row it was paid. */
  months: number;
}

export interface RecurringOverview {
  month: MonthKey;
  /** Every fixed item, the paused ones included, by name. */
  items: RecurringMonth[];
  suggestions: RecurringSuggestion[];
  /** Merchants the user said are not fixed. */
  ignored: Recurring[];
}
