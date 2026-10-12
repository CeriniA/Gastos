import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  LastRate,
  ReferenceRate,
  MonthSummary,
  Paginated,
  Transaction,
  TransactionCreate,
  TransactionListQuery,
  TransactionUpdate,
} from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['transactions'] as const;

export function useTransactions(query: Partial<TransactionListQuery>) {
  return useQuery({
    queryKey: [...KEY, 'list', query],
    queryFn: () => api<Paginated<Transaction>>('/transactions', { query }),
  });
}

/** How many transactions each "load more" brings. */
const PAGE_SIZE = 50;

/** A filtered list that grows page by page. */
export function useTransactionPages(filters: Omit<Partial<TransactionListQuery>, 'page' | 'pageSize'>) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'pages', filters],
    queryFn: ({ pageParam }) =>
      api<Paginated<Transaction>>('/transactions', {
        query: { ...filters, page: pageParam, pageSize: PAGE_SIZE },
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api<Transaction>(`/transactions/${id}`),
    enabled: Boolean(id),
  });
}

export function useMonthSummary(month: string) {
  return useQuery({
    queryKey: [...KEY, 'summary', month],
    queryFn: () => api<MonthSummary>('/transactions/summary', { query: { month } }),
  });
}

/** The last exchange rate the user applied to a foreign currency, if any. */
export function useLastRate(currency: string | null) {
  return useQuery({
    queryKey: [...KEY, 'last-rate', currency],
    queryFn: () => api<LastRate>('/transactions/last-rate', { query: { currency } }),
    enabled: Boolean(currency),
  });
}

/** A public market rate between two currencies, or null when the source has none. */
export function useReferenceRate(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['exchange-rates', 'reference', from, to],
    queryFn: () => api<ReferenceRate | null>('/exchange-rates/reference', { query: { from, to } }),
    enabled: Boolean(from && to && from !== to),
    staleTime: 60 * 60 * 1000,
  });
}

export function useTransactionMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({
      mutationFn: (input: TransactionCreate) =>
        api<Transaction>('/transactions', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: TransactionUpdate }) =>
        api<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    restore: useMutation({
      mutationFn: (id: string) => api<Transaction>(`/transactions/${id}/restore`, { method: 'POST' }),
      onSuccess: refresh,
    }),
    /** Only for what is already in the trash. Cannot be undone. */
    removeForever: useMutation({
      mutationFn: (id: string) => api<void>(`/transactions/${id}/permanent`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    emptyTrash: useMutation({
      mutationFn: () => api<{ deleted: number }>('/transactions/trash', { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
