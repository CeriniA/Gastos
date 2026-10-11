import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Server data has one copy on the client: this cache. Components read it
 * through the hooks in each feature's api.ts and never keep their own copy.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // The free server sleeps: a network failure usually means it is waking up.
      retry: (failures, error) => error instanceof ApiError && error.code === 'NETWORK' && failures < 12,
      retryDelay: 5_000,
    },
  },
});
