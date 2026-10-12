import { useEffect, useState } from 'react';
import { fetchBlob } from '../../shared/api/client';
import { es } from '../../shared/i18n/es';

/**
 * One stored image of a document. It is fetched with the session token (an
 * <img src> cannot send it) and released when the screen is left.
 */
export function DocumentImage({ documentId, index }: { documentId: string; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    fetchBlob(`/documents/${documentId}/files/${index}`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, index]);

  if (failed) return null;
  if (!url) return <div className="h-40 animate-pulse rounded-lg bg-line" aria-hidden="true" />;
  return (
    <img
      src={url}
      alt={es.documents.imageAlt(index + 1)}
      className="w-full rounded-lg border border-line bg-surface"
    />
  );
}
