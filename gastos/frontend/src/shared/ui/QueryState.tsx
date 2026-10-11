import type { ReactNode } from 'react';
import { errorMessage } from '../api/errors';
import { es } from '../i18n/es';
import { Button, Loading, Notice } from './ui';

/**
 * The three states every list has besides its content: loading, failed and
 * empty. Screens wrap their content in this instead of repeating the checks.
 */
export function QueryState<T>({
  query,
  empty,
  children,
}: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  /** Shown when the data is an empty list. Says what to do next. */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.error || query.data === undefined) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{errorMessage(query.error)}</Notice>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {es.common.retry}
        </Button>
      </div>
    );
  }
  if (empty && Array.isArray(query.data) && query.data.length === 0) {
    return <Notice>{empty}</Notice>;
  }
  return <>{children(query.data)}</>;
}
