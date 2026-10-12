import { z } from 'zod';
import { TEXT_LIMITS, type ProductGroup } from '../constants';
import { isoDateSchema, monthKeySchema } from './common';

/**
 * Consumption: what was bought, read from the lines of receipts. It only
 * covers purchases that came with a detailed receipt.
 */
export const consumptionSummaryQuerySchema = z.object({ month: monthKeySchema });

export const consumptionSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(TEXT_LIMITS.name),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

/** One line of a receipt, with the purchase it belongs to. */
export interface ConsumptionItem {
  transactionId: string;
  /** Day of the purchase. */
  date: string;
  /** Description of the purchase, usually the shop. */
  description: string;
  currency: string;
  name: string;
  product: string;
  group: ProductGroup | null;
  quantity: number | null;
  /** Negative on a refund's lines: the thing was given back. */
  amountCents: number;
  /** The line belongs to a refund: it takes away and is not a purchase. */
  refund: boolean;
}

export interface ProductConsumption {
  product: string;
  totalCents: number;
  /** How many receipt lines it appeared on. */
  purchases: number;
  /** Sum of the quantities, or null when some line did not state one. */
  quantity: number | null;
}

export interface GroupConsumption {
  /** Null gathers the lines the AI could not classify. */
  group: ProductGroup | null;
  totalCents: number;
  products: ProductConsumption[];
}

export interface CurrencyConsumption {
  currency: string;
  totalCents: number;
  groups: GroupConsumption[];
}

export interface ConsumptionSummary {
  month: string;
  /** One entry per currency, each with its groups from largest to smallest. */
  currencies: CurrencyConsumption[];
}
