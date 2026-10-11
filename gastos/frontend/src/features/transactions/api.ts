import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
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
  };
}
