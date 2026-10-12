import { z } from 'zod';
import { CURRENCIES, DEFAULT_PAGE_SIZE, MAX_AMOUNT_CENTS, MAX_PAGE_SIZE, TEXT_LIMITS } from '../constants';
import { isIsoDate, isMonthKey } from '../dates';

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const isoDateSchema = z.string().refine(isIsoDate, 'Expected a date as YYYY-MM-DD');
export const monthKeySchema = z.string().refine(isMonthKey, 'Expected a month as YYYY-MM');
export const currencySchema = z.enum(CURRENCIES);
/** Any ISO 4217 code, for amounts printed in a currency the app has no accounts in. */
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Expected a currency code such as BRL');

/** Positive integer cents. The upper bound keeps sums inside safe integers. */
export const amountCentsSchema = z.number().int().positive().max(MAX_AMOUNT_CENTS);

export const nameSchema = z.string().trim().min(1).max(TEXT_LIMITS.name);

export const idParamsSchema = z.object({ id: objectIdSchema });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Query-string boolean: "true" / "false". */
export const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
