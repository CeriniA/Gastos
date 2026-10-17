import { z } from 'zod';
import { MAX_RATE } from '../constants';
import type { IsoDate } from '../dates';
import { currencyCodeSchema, isoDateSchema } from './common';

export const referenceRateQuerySchema = z.object({ from: currencyCodeSchema, to: currencyCodeSchema });

/**
 * A market exchange rate from a public source, offered as a starting point
 * when a receipt is in another currency. It is a reference: what a payment
 * app really charged may differ, so the user can always change it.
 */
export interface ReferenceRate {
  /** Units of `to` per one unit of `from`. */
  rate: number;
  from: string;
  to: string;
  /** Day the source last updated the rate. */
  asOf: string;
  /** Who publishes it, shown next to the figure. */
  source: string;
}

/** A rate of pesos per dollar the user loads by hand, valid from a day until the next one starts. */
export const exchangeRateInputSchema = z.object({
  validFrom: isoDateSchema,
  arsPerUsd: z.number().positive().max(MAX_RATE),
});
export type ExchangeRateInput = z.infer<typeof exchangeRateInputSchema>;

export interface ExchangeRate {
  id: string;
  validFrom: IsoDate;
  /** Pesos per dollar. A rate, not an amount of money. */
  arsPerUsd: number;
  createdAt: string;
  updatedAt: string;
}
