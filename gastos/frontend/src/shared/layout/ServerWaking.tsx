import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { es } from '../i18n/es';
import { Notice } from '../ui/ui';

/**
 * The free server sleeps after 15 minutes without use and takes about a
 * minute to wake. If the health check has not answered after a few seconds,
 * say so instead of looking broken.
 */
export function ServerWaking() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string }>('/health'),
    staleTime: 60_000,
  });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!health.isPending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 3_000);
    return () => clearTimeout(timer);
  }, [health.isPending]);

  if (!slow) return null;
  return (
    <div className="mb-4">
      <Notice tone="attention">{es.server.waking}</Notice>
    </div>
  );
}
