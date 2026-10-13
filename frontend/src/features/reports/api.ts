import { useQuery } from '@tanstack/react-query';
import type { CategoryReport, ConsumptionItem, ConsumptionSummary } from '@gastos/shared';
import { api } from '../../shared/api/client';

// Under 'transactions' so that any change to a transaction refreshes it too.
const KEY = ['transactions', 'consumption'] as const;

/** Income and expenses of a month by category. */
export function useCategoryReport(month: string) {
  return useQuery({
    queryKey: ['transactions', 'reports', 'categories', month],
    queryFn: () => api<CategoryReport>('/reports/categories', { query: { month } }),
  });
}

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
