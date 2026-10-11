import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category, CategoryCreate, CategoryUpdate } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['categories'] as const;

export function useCategories() {
  return useQuery({ queryKey: KEY, queryFn: () => api<Category[]>('/categories') });
}

export function useCategoryMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({
      mutationFn: (input: CategoryCreate) => api<Category>('/categories', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: CategoryUpdate }) =>
        api<Category>(`/categories/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
