import { z } from 'zod';
import { ACCOUNT_TYPES, type AccountType, type Currency } from '../constants';
import { currencySchema, nameSchema, objectIdSchema } from './common';

export const accountCreateSchema = z.object({
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPES),
  currency: currencySchema,
  /** The bank or company that issues it. Optional. */
  bankId: objectIdSchema.nullable().default(null),
  /** The card brand (Visa, Mastercard…). Credit cards only. */
  networkId: objectIdSchema.nullable().default(null),
});
export type AccountCreate = z.infer<typeof accountCreateSchema>;

/** Type and currency are fixed at creation: transactions depend on them. */
export const accountUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    archived: z.boolean().optional(),
    bankId: objectIdSchema.nullable().optional(),
    networkId: objectIdSchema.nullable().optional(),
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
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
