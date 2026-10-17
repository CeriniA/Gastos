import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Recurring, RecurringFromTransaction, RecurringOverview, RecurringUpdate } from '@gastos/shared';
import { api } from '../../shared/api/client';

// Under 'transactions': a transaction that arrives, or changes, changes how its fixed item stands.
const KEY = ['transactions', 'recurrings'] as const;

/** Every fixed item and how it stands this month, plus what looks fixed. */
export function useRecurrings() {
  return useQuery({ queryKey: KEY, queryFn: () => api<RecurringOverview>('/recurrings') });
}

export function useRecurringMutations() {
  const client = useQueryClient();
  // The projection and the transactions' marks change with them.
  const refresh = () => client.invalidateQueries({ queryKey: ['transactions'] });
  return {
    fromTransaction: useMutation({
      mutationFn: (input: RecurringFromTransaction) =>
        api<Recurring>('/recurrings/from-transaction', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: RecurringUpdate }) =>
        api<Recurring>(`/recurrings/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/recurrings/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
