import { MS_PER_SECOND, type ReferenceRate } from '@gastos/shared';
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
  /** Told when the service could not be reached or answered badly; the rate is then simply missing. */
  onError?: (error: unknown) => void;
}

const ENDPOINT = 'https://open.er-api.com/v6/latest';
const SOURCE = 'exchangerate-api.com';

interface ApiResponse {
  result?: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
}

/** Public rates change once a day; asking more often only spends the free quota. */
const DEFAULT_CACHE_MS = 6 * 60 * 60 * 1000;
/** A reference rate is a convenience: better none than a slow review screen. */
const TIMEOUT_MS = 8_000;

export function createOpenExchangeRates(options: OpenExchangeRatesOptions = {}): RateProvider {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cacheMs = options.cacheMs ?? DEFAULT_CACHE_MS;
  const cache = new Map<string, { at: number; asOf: string; rates: Record<string, number> }>();

  async function load(base: string) {
    const cached = cache.get(base);
    if (cached && now() - cached.at < cacheMs) return cached;
    try {
      const response = await doFetch(`${ENDPOINT}/${encodeURIComponent(base)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Rates service answered ${response.status}`);
      const data = (await response.json()) as ApiResponse;
      if (data.result !== 'success' || !data.rates) throw new Error('Rates service answered without rates');
      const updated = new Date((data.time_last_update_unix ?? now() / MS_PER_SECOND) * MS_PER_SECOND);
      const entry = { at: now(), asOf: updated.toISOString().slice(0, 10), rates: data.rates };
      cache.set(base, entry);
      return entry;
    } catch (error) {
      options.onError?.(error);
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
