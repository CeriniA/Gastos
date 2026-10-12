import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Server data has one copy on the client: this cache. Components read it
 * through the hooks in each feature's api.ts and never keep their own copy.
 */
/** Data younger than this is shown without asking the server again. */
const FRESH_MS = 30_000;
/** While the free server wakes up (about a minute), it is asked again this often, this many times. */
const WAKE_RETRY_MS = 5_000;
const WAKE_RETRIES = 12;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FRESH_MS,
      refetchOnWindowFocus: false,
      // The free server sleeps: a network failure usually means it is waking up.
      retry: (failures, error) =>
        error instanceof ApiError && error.code === 'NETWORK' && failures < WAKE_RETRIES,
      retryDelay: WAKE_RETRY_MS,
    },
  },
});
