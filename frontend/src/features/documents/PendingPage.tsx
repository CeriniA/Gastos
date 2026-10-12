import { Link } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  PENDING_DOCUMENT_RETENTION_DAYS,
  formatTime,
  type DocumentSummary,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { useAction } from '../../shared/ui/useAction';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Notice, PageTitle } from '../../shared/ui/ui';
import { useDocumentMutations, usePendingDocuments } from './api';

const TONE: Record<DocumentSummary['status'], string> = {
  processing: 'text-muted',
  ready: 'text-income',
  error: 'text-expense',
  confirmed: 'text-muted',
  discarded: 'text-muted',
};

/** The single tray of everything waiting for the user's decision. */
export function PendingPage() {
  const documents = usePendingDocuments();
  const { retry, discard } = useDocumentMutations();
  const { failure, run } = useAction();

  const discardDocument = (id: string) => {
    if (window.confirm(es.documents.discardConfirm)) void run(discard.mutateAsync(id));
  };

  return (
    <>
      <PageTitle>{es.documents.pendingTitle}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.documents.expiry(PENDING_DOCUMENT_RETENTION_DAYS)}</p>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={documents} empty={es.documents.empty}>
        {(items) => (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((document) => (
              <li key={document.id} className="p-3">
                <p className={`font-semibold ${document.retryAt ? 'text-attention' : TONE[document.status]}`}>
                  {document.retryAt ? es.documents.waiting : es.documents.statuses[document.status]}
                  {document.status === 'ready' && document.transactionCount !== null
                    ? `, ${es.documents.found(document.transactionCount)}`
                    : ''}
                </p>
                <p className="truncate text-sm text-muted">
                  {es.add.kinds[document.kind]}, {document.fileName}
                </p>
                {document.status === 'error' && document.errorCode ? (
                  <p className="mt-1 text-sm">{es.documents.errors[document.errorCode]}</p>
                ) : null}
                {document.retryAt ? (
                  <p className="mt-1 text-sm">
                    {es.documents.waitingText(formatTime(document.retryAt, DEFAULT_TIMEZONE), document.waits)}
                  </p>
                ) : null}

                {document.status === 'processing' && !document.retryAt ? null : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {document.status === 'ready' ? (
                      <Link
                        to={`/pendientes/${document.id}`}
                        className="inline-flex min-h-11 items-center rounded-lg bg-income px-4 font-semibold text-surface"
                      >
                        {es.documents.review}
                      </Link>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={retry.isPending}
                      onClick={() => void run(retry.mutateAsync(document.id))}
                    >
                      {document.retryAt
                        ? es.documents.retryNow
                        : document.status === 'error'
                          ? es.documents.retry
                          : es.documents.reread}
                    </Button>
                    <Button
                      variant="quiet"
                      className="text-expense"
                      onClick={() => discardDocument(document.id)}
                    >
                      {es.documents.discard}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
