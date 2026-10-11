import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, AccountCreate, AccountUpdate } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['accounts'] as const;

export function useAccounts() {
  return useQuery({ queryKey: KEY, queryFn: () => api<Account[]>('/accounts') });
}

export function useAccountMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({
      mutationFn: (input: AccountCreate) => api<Account>('/accounts', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: AccountUpdate }) =>
        api<Account>(`/accounts/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/accounts/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
