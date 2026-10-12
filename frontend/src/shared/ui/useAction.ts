import { useCallback, useState } from 'react';
import { errorMessage } from '../api/errors';

/**
 * Runs a change the user asked for and keeps the message of the last failure.
 * Every screen that saves something uses it, so errors are shown the same way.
 */
export function useAction() {
  const [failure, setFailure] = useState<string | null>(null);

  /** Resolves true when the work went through, false when it failed (and the reason is in `failure`). */
  const run = useCallback(async (work: Promise<unknown> | (() => Promise<unknown>)): Promise<boolean> => {
    setFailure(null);
    try {
      await (typeof work === 'function' ? work() : work);
      return true;
    } catch (error) {
      setFailure(errorMessage(error));
      return false;
    }
  }, []);

  return { failure, setFailure, run };
}
