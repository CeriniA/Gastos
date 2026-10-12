import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tag, TagInput } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['tags'] as const;

export function useTags() {
  return useQuery({ queryKey: KEY, queryFn: () => api<Tag[]>('/tags') });
}

export function useCreateTag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TagInput) => api<Tag>('/tags', { method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTagMutations() {
  const client = useQueryClient();
  return {
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) =>
        api<Tag>(`/tags/${id}`, { method: 'PATCH', body: { name } }),
      onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
    }),
    /** Deleting a tag takes it off its transactions, so those are refreshed too. */
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/tags/${id}`, { method: 'DELETE' }),
      onSuccess: () => client.invalidateQueries(),
    }),
  };
}
