import { useCallback, useState } from 'react';
import { errorMessage } from '../api/errors';

interface RunOptions {
  /**
   * Lets the screen deal with a failure itself, for example by marking the fields the server
   * rejected. Return true when it did (then no message is made from the error), false to get
   * the usual message.
   */
  onError?: (error: unknown) => boolean;
}

/**
 * Runs a change the user asked for and keeps the message of the last failure.
 * Every screen that saves something uses it, so errors are shown the same way.
 * A screen can say more precisely what some failures mean with `describe`.
 */
export function useAction(describe: (error: unknown) => string = errorMessage) {
  const [failure, setFailure] = useState<string | null>(null);

  /** Resolves true when the work went through, false when it failed (and the reason is in `failure`). */
  const run = useCallback(
    async (work: Promise<unknown> | (() => Promise<unknown>), options: RunOptions = {}): Promise<boolean> => {
      setFailure(null);
      try {
        await (typeof work === 'function' ? work() : work);
        return true;
      } catch (error) {
        if (!options.onError?.(error)) setFailure(describe(error));
        return false;
      }
    },
    [describe],
  );

  return { failure, setFailure, run };
}
