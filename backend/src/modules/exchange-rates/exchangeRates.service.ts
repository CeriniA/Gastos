import type { ReferenceRate } from '@gastos/shared';
import type { RateProvider } from '../../providers/rates/rateProvider';

/**
 * Exchange rates. For now only the public reference rate offered when a
 * receipt is in another currency; the user's own dated rates for consolidated
 * reports arrive with stage 4.
 */
export function createExchangeRatesService(provider: RateProvider | null) {
  return {
    /** Null when there is no source or it cannot answer: the user types the rate. */
    async reference(from: string, to: string): Promise<ReferenceRate | null> {
      if (!provider || from === to) return null;
      return provider.reference(from, to);
    },
  };
}

export type ExchangeRatesService = ReturnType<typeof createExchangeRatesService>;
