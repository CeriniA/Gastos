import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CardPayment,
  CardPeriod,
  CardPeriodCreate,
  CardPeriodUpdate,
  CardStatement,
  Transaction,
} from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['card-periods'] as const;

export function useCardStatement(accountId: string) {
  return useQuery({
    queryKey: [...KEY, accountId],
    queryFn: () => api<CardStatement>('/card-periods', { query: { accountId } }),
    enabled: Boolean(accountId),
  });
}

export function useCardPeriodMutations() {
  const client = useQueryClient();
  // A statement moves payment dates, so the balance and the lists change too.
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: KEY });
    await client.invalidateQueries({ queryKey: ['transactions'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CardPeriodCreate) =>
        api<CardPeriod[]>('/card-periods', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: CardPeriodUpdate }) =>
        api<CardPeriod>(`/card-periods/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/card-periods/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    /** Registers a payment of the statement: a transfer from another account to the card. */
    pay: useMutation({
      mutationFn: ({ id, payment }: { id: string; payment: CardPayment }) =>
        api<Transaction>(`/card-periods/${id}/payments`, { method: 'POST', body: payment }),
      onSuccess: refresh,
    }),
  };
}
