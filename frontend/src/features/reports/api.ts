import { useQuery } from '@tanstack/react-query';
import type { ConsumptionItem, ConsumptionSummary } from '@gastos/shared';
import { api } from '../../shared/api/client';

// Under 'transactions' so that any change to a transaction refreshes it too.
const KEY = ['transactions', 'consumption'] as const;

export function useConsumptionSummary(month: string) {
  return useQuery({
    queryKey: [...KEY, 'summary', month],
    queryFn: () => api<ConsumptionSummary>('/consumption/summary', { query: { month } }),
  });
}

/** Receipt lines matching the words searched. Asks only once there is something to look for. */
export function useConsumptionSearch(q: string) {
  return useQuery({
    queryKey: [...KEY, 'items', q],
    queryFn: () => api<ConsumptionItem[]>('/consumption/items', { query: { q } }),
    enabled: q.length >= 2,
  });
}
