import { useEffect, useState } from 'react';

/** How long to wait after the last key press before searching. */
const SEARCH_DELAY_MS = 350;

/**
 * The value, once it has stopped changing for a moment. Search boxes use it
 * so the server is asked when the user pauses, not on every key press.
 */
export function useDebounced<T>(value: T, delayMs: number = SEARCH_DELAY_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
