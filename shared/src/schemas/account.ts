import { z } from 'zod';
import { ACCOUNT_TYPES, MAX_AMOUNT_CENTS, type AccountType, type Currency } from '../constants';
import type { IsoDate } from '../dates';
import { currencySchema, isoDateSchema, nameSchema, objectIdSchema } from './common';

/**
 * What an account had on a day, as the bank or the app said: where its
 * balance starts counting. Negative for an overdrawn account or a card's debt.
 */
export const openingBalanceSchema = z.object({
  amountCents: z.number().int().min(-MAX_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS),
  date: isoDateSchema,
});
export type OpeningBalance = z.infer<typeof openingBalanceSchema>;

export const accountCreateSchema = z.object({
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPES),
  currency: currencySchema,
  /** The bank or company that issues it. Optional. */
  bankId: objectIdSchema.nullable().default(null),
  /** The card brand (Visa, Mastercard…). Credit cards only. */
  networkId: objectIdSchema.nullable().default(null),
  openingBalance: openingBalanceSchema.nullable().default(null),
});
export type AccountCreate = z.infer<typeof accountCreateSchema>;

/** Type and currency are fixed at creation: transactions depend on them. */
export const accountUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    archived: z.boolean().optional(),
    bankId: objectIdSchema.nullable().optional(),
    networkId: objectIdSchema.nullable().optional(),
    openingBalance: openingBalanceSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type AccountUpdate = z.infer<typeof accountUpdateSchema>;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  bankId: string | null;
  networkId: string | null;
  /** Null: the balance counts every movement from the first one, starting at zero. */
  openingBalance: OpeningBalance | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const accountBalancesQuerySchema = z.object({ on: isoDateSchema.optional() });

/**
 * How much an account has on a day: its opening balance plus every confirmed
 * movement since then, up to that day. Calculated, never stored.
 */
export interface AccountBalance {
  accountId: string;
  currency: Currency;
  balanceCents: number;
  /** The day it is worked out for. */
  on: IsoDate;
}
