import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExchangeRate, ExchangeRateInput } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['exchange-rates'] as const;

export function useExchangeRates() {
  return useQuery({ queryKey: KEY, queryFn: () => api<ExchangeRate[]>('/exchange-rates') });
}

export function useExchangeRateMutations() {
  const client = useQueryClient();
  // A rate changes how the reports add up: they are asked again.
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: KEY }),
      client.invalidateQueries({ queryKey: ['transactions', 'reports'] }),
    ]);
  return {
    create: useMutation({
      mutationFn: (input: ExchangeRateInput) =>
        api<ExchangeRate>('/exchange-rates', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ExchangeRateInput }) =>
        api<ExchangeRate>(`/exchange-rates/${id}`, { method: 'PATCH', body: input }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/exchange-rates/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
