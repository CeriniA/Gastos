import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, UserCreate, UserUpdate } from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['users'] as const;

/** Everybody who can sign in. Only an admin may ask. */
export function useUsers() {
  return useQuery({ queryKey: KEY, queryFn: () => api<User[]>('/users') });
}

export function useUserMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({
      mutationFn: (input: UserCreate) => api<User>('/users', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    /** A new password, or whether the user can sign in. */
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: UserUpdate }) =>
        api<User>(`/users/${id}`, { method: 'PATCH', body: changes }),
      onSuccess: refresh,
    }),
  };
}
