import type { ReferenceRate } from '@gastos/shared';

/**
 * The app's only view of an exchange-rate source. Like the AI, the provider
 * behind it can be swapped in the composition root.
 *
 * Implementations never throw: a source that is down or does not know the
 * currency simply yields null, and the user types the rate by hand.
 */
export interface RateProvider {
  reference(from: string, to: string): Promise<ReferenceRate | null>;
}
