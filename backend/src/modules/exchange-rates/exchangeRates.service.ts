import type { ExchangeRate, ExchangeRateInput, ReferenceRate } from '@gastos/shared';
import { DuplicateError, NotFoundError } from '../../core/errors/errors';
import type { RateProvider } from '../../providers/rates/rateProvider';
import type { ExchangeRatesRepository } from './exchangeRates.repository';

/**
 * Exchange rates: the public reference offered when a receipt is in another
 * currency, and the user's own pesos-per-dollar rates, each valid from a day,
 * that the reports use to show everything in one currency. A rate never
 * changes anything stored: it is only applied when a report is asked for.
 */
export function createExchangeRatesService(
  repository: ExchangeRatesRepository,
  provider: RateProvider | null,
) {
  /** Two rates cannot start on the same day: which one would apply? */
  async function checkFreeDay(validFrom: string, ownId?: string): Promise<void> {
    const existing = await repository.findByValidFrom(validFrom);
    if (existing && existing.id !== ownId) throw new DuplicateError('ExchangeRate', 'validFrom');
  }

  return {
    /** Null when there is no source or it cannot answer: the user types the rate. */
    async reference(from: string, to: string): Promise<ReferenceRate | null> {
      if (!provider || from === to) return null;
      return provider.reference(from, to);
    },

    list(): Promise<ExchangeRate[]> {
      return repository.findAll();
    },

    async create(input: ExchangeRateInput): Promise<ExchangeRate> {
      await checkFreeDay(input.validFrom);
      return repository.create(input);
    },

    async update(id: string, input: ExchangeRateInput): Promise<ExchangeRate> {
      await checkFreeDay(input.validFrom, id);
      const updated = await repository.update(id, input);
      if (!updated) throw new NotFoundError('ExchangeRate', id);
      return updated;
    },

    /** Nothing points at a rate, so it can always go; the reports simply stop using it. */
    async remove(id: string): Promise<void> {
      if (!(await repository.delete(id))) throw new NotFoundError('ExchangeRate', id);
    },
  };
}

export type ExchangeRatesService = ReturnType<typeof createExchangeRatesService>;
