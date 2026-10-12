import type { ReferenceRate } from '@gastos/shared';
import type { RateProvider } from './rateProvider';

/**
 * Reference rates from the free, key-less endpoint of exchangerate-api.com
 * (open.er-api.com). It covers every currency pair and updates once a day,
 * so answers are cached for a few hours per base currency.
 *
 * Its terms ask for attribution, which is why `source` travels with the rate
 * and is shown to the user.
 */

export interface OpenExchangeRatesOptions {
  /** Injected in tests. */
  fetch?: typeof fetch;
  now?: () => number;
  cacheMs?: number;
}

const ENDPOINT = 'https://open.er-api.com/v6/latest';
const SOURCE = 'exchangerate-api.com';

interface ApiResponse {
  result?: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
}

export function createOpenExchangeRates(options: OpenExchangeRatesOptions = {}): RateProvider {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cacheMs = options.cacheMs ?? 6 * 60 * 60 * 1000;
  const cache = new Map<string, { at: number; asOf: string; rates: Record<string, number> }>();

  async function load(base: string) {
    const cached = cache.get(base);
    if (cached && now() - cached.at < cacheMs) return cached;
    try {
      const response = await doFetch(`${ENDPOINT}/${encodeURIComponent(base)}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as ApiResponse;
      if (data.result !== 'success' || !data.rates) return null;
      const updated = new Date((data.time_last_update_unix ?? now() / 1000) * 1000);
      const entry = { at: now(), asOf: updated.toISOString().slice(0, 10), rates: data.rates };
      cache.set(base, entry);
      return entry;
    } catch {
      return null;
    }
  }

  return {
    async reference(from, to): Promise<ReferenceRate | null> {
      const entry = await load(from);
      const rate = entry?.rates[to];
      if (!entry || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
      return { rate, from, to, asOf: entry.asOf, source: SOURCE };
    },
  };
}
