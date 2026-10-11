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
