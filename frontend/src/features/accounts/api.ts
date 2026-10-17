import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, AccountBalance, AccountCreate, AccountUpdate } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['accounts'] as const;
// Under 'transactions': every transaction that is saved changes a balance.
const BALANCES = ['transactions', 'balances'] as const;

export function useAccounts() {
  return useQuery({ queryKey: KEY, queryFn: () => api<Account[]>('/accounts') });
}

/** Today's balance of every account that is not archived. */
export function useAccountBalances() {
  return useQuery({ queryKey: BALANCES, queryFn: () => api<AccountBalance[]>('/accounts/balances') });
}

/** One account's balance on a day (today without one). Asks only once there is an account. */
export function useAccountBalance(accountId: string | null, on: string | null) {
  return useQuery({
    queryKey: [...BALANCES, accountId, on],
    queryFn: () =>
      api<AccountBalance>(`/accounts/${accountId ?? ''}/balance`, { query: { on: on ?? undefined } }),
    enabled: accountId !== null,
  });
}

export function useAccountMutations() {
  const client = useQueryClient();
  // An opening balance changes the balances too.
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: KEY }),
      client.invalidateQueries({ queryKey: BALANCES }),
    ]);
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
