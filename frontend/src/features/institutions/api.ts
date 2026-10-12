import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Institution, InstitutionCreate, InstitutionUpdate } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['institutions'] as const;

export function useInstitutions() {
  return useQuery({ queryKey: KEY, queryFn: () => api<Institution[]>('/institutions') });
}

export function useInstitutionMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({
      mutationFn: (input: InstitutionCreate) =>
        api<Institution>('/institutions', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: InstitutionUpdate }) =>
        api<Institution>(`/institutions/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/institutions/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
