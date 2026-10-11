import { z } from 'zod';
import { CURRENCIES } from '../constants';
import { isIsoDate, isMonthKey } from '../dates';

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const isoDateSchema = z.string().refine(isIsoDate, 'Expected a date as YYYY-MM-DD');
export const monthKeySchema = z.string().refine(isMonthKey, 'Expected a month as YYYY-MM');
export const currencySchema = z.enum(CURRENCIES);

/** Positive integer cents. The upper bound keeps sums inside safe integers. */
export const amountCentsSchema = z.number().int().positive().max(1_000_000_000_000);

export const nameSchema = z.string().trim().min(1).max(60);

export const idParamsSchema = z.object({ id: objectIdSchema });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Query-string boolean: "true" / "false". */
export const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
