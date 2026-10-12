import { z } from 'zod';
import { currencyCodeSchema } from './common';

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
