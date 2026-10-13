import { z } from 'zod';
import type { CategoryKind } from '../constants';
import { monthKeySchema } from './common';

/**
 * Reports: what came in and what went out in a month, by category. Like the
 * monthly balance, it counts each transaction in the month it is paid.
 */
export const categoryReportQuerySchema = z.object({ month: monthKeySchema });

/** One category with everything filed under it and under its subcategories. */
export interface CategoryAmount {
  /** Null gathers what has no category. */
  categoryId: string | null;
  name: string;
  /** Its own plus its subcategories': refunds already taken away. */
  totalCents: number;
  /** Subcategories with something in the month, largest first. */
  children: CategoryAmount[];
}

/** The income or the expenses of a month in one currency, by category. */
export interface KindReport {
  kind: CategoryKind;
  totalCents: number;
  /** Root categories with something in the month, largest first. */
  categories: CategoryAmount[];
}

export interface CurrencyCategoryReport {
  currency: string;
  income: KindReport;
  expense: KindReport;
}

export interface CategoryReport {
  month: string;
  /** One entry per currency: amounts in different currencies are never added together. */
  currencies: CurrencyCategoryReport[];
}

/** What one transaction, or one part of a divided one, adds to a category. */
export interface FiledAmount {
  kind: CategoryKind;
  currency: string;
  categoryId: string | null;
  /** Negative for a refund: it takes away from its category. */
  cents: number;
}
