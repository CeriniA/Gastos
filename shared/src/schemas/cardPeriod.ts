import { z } from 'zod';
import { amountCentsSchema, isoDateSchema, objectIdSchema } from './common';

/**
 * One statement of a credit card: the day it closes and the day it is paid.
 * Purchases made after the previous closing and up to this one are paid on
 * this due date. Both dates are what the statement says, so they are typed,
 * never worked out.
 */
const periodFields = {
  closingDate: isoDateSchema,
  dueDate: isoDateSchema,
  /** As the statement states it. Optional: the app adds up its own. */
  totalCents: amountCentsSchema.nullable(),
  minimumPaymentCents: amountCentsSchema.nullable(),
};

const dueAfterClosing = (value: { closingDate?: string; dueDate?: string }) =>
  !value.closingDate || !value.dueDate || value.dueDate > value.closingDate;
const DUE_AFTER_CLOSING = { message: 'The due date must be after the closing date', path: ['dueDate'] };

export const cardPeriodCreateSchema = z
  .object({
    /** A card with pesos and dollars is two accounts that share their dates: one period each. */
    accountIds: z.array(objectIdSchema).min(1).max(4),
    ...periodFields,
    totalCents: periodFields.totalCents.default(null),
    minimumPaymentCents: periodFields.minimumPaymentCents.default(null),
  })
  .refine(dueAfterClosing, DUE_AFTER_CLOSING);
export type CardPeriodCreate = z.infer<typeof cardPeriodCreateSchema>;

export const cardPeriodUpdateSchema = z
  .object(periodFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
  .refine(dueAfterClosing, DUE_AFTER_CLOSING);
export type CardPeriodUpdate = z.infer<typeof cardPeriodUpdateSchema>;

export const cardPeriodListQuerySchema = z.object({ accountId: objectIdSchema });

/**
 * Paying a statement: money moves from one of the user's accounts to the card.
 * It is stored as a transfer linked to the statement, never as an expense (the
 * purchases already are).
 */
export const cardPaymentSchema = z.object({
  /** The account the money comes out of. */
  accountId: objectIdSchema,
  date: isoDateSchema,
  /** What leaves that account, in its currency. */
  amountCents: amountCentsSchema,
  /** What reaches the card, when it is in another currency (dollars paid with pesos). */
  toAmountCents: amountCentsSchema.nullable().default(null),
});
export type CardPayment = z.infer<typeof cardPaymentSchema>;

export interface CardPeriod {
  id: string;
  accountId: string;
  closingDate: string;
  dueDate: string;
  totalCents: number | null;
  minimumPaymentCents: number | null;
  /** The statement the dates were read from, when there is one (PDF reading, later). */
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A period with what the app has charged to it, to compare with the statement. */
export interface CardPeriodView extends CardPeriod {
  /** Expenses minus credits of the card paid on this due date, installments included. */
  chargedCents: number;
  transactionCount: number;
  /** What the payments registered for this statement add up to, in the card's currency. */
  paidCents: number;
}

export interface CardStatement {
  accountId: string;
  /** Newest first. */
  periods: CardPeriodView[];
  /** Purchases after the last known closing: paid on their own date until a period covers them. */
  open: { since: string | null; chargedCents: number; transactionCount: number };
}
