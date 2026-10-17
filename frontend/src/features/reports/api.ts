import { useQuery } from '@tanstack/react-query';
import type {
  AccountReport,
  CategoryReport,
  ConsumptionItem,
  ConsumptionSummary,
  Currency,
  EvolutionReport,
  MerchantReport,
  ProjectionReport,
} from '@gastos/shared';
import { api } from '../../shared/api/client';

// Under 'transactions' so that any change to a transaction refreshes them too.
const KEY = ['transactions', 'consumption'] as const;
const REPORTS = ['transactions', 'reports'] as const;

/** The currency everything is shown in, or undefined for each one apart. */
export type ShowIn = Currency | undefined;

/** What every report of one month receives from the reports screen. */
export interface MonthReportProps {
  month: string;
  onMonth: (month: string) => void;
  showIn: ShowIn;
}

/** Income and expenses of a month by category. */
export function useCategoryReport(month: string, showIn: ShowIn) {
  return useQuery({
    queryKey: [...REPORTS, 'categories', month, showIn],
    queryFn: () => api<CategoryReport>('/reports/categories', { query: { month, in: showIn } }),
  });
}

export function useAccountReport(month: string, showIn: ShowIn) {
  return useQuery({
    queryKey: [...REPORTS, 'accounts', month, showIn],
    queryFn: () => api<AccountReport>('/reports/accounts', { query: { month, in: showIn } }),
  });
}

export function useMerchantReport(month: string, showIn: ShowIn) {
  return useQuery({
    queryKey: [...REPORTS, 'merchants', month, showIn],
    queryFn: () => api<MerchantReport>('/reports/merchants', { query: { month, in: showIn } }),
  });
}

/** Month by month, ending in `to`. */
export function useEvolution(to: string, months: number, showIn: ShowIn) {
  return useQuery({
    queryKey: [...REPORTS, 'evolution', to, months, showIn],
    queryFn: () => api<EvolutionReport>('/reports/evolution', { query: { to, months, in: showIn } }),
  });
}

/** This month and the next ones: what is loaded plus what is expected. */
export function useProjection(showIn: ShowIn) {
  return useQuery({
    queryKey: [...REPORTS, 'projection', showIn],
    queryFn: () => api<ProjectionReport>('/reports/projection', { query: { in: showIn } }),
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
