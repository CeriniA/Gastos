import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentConfirm,
  DocumentConfirmResult,
  DocumentDetail,
  DocumentSummary,
  StatementPreview,
  StatementUpload,
  UploadableDocumentKind,
} from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['documents'] as const;
/** How often to ask again while the AI is reading. */
const POLL_MS = 3_000;
/** How often to ask again while a document only waits for the AI to have room. */
const WAITING_POLL_MS = 60_000;

/** Quick while something is being read, slow while documents only wait, not at all otherwise. */
function pollInterval(documents: readonly DocumentSummary[] | undefined): number | false {
  const processing = (documents ?? []).filter((document) => document.status === 'processing');
  if (processing.some((document) => document.retryAt === null)) return POLL_MS;
  return processing.length > 0 ? WAITING_POLL_MS : false;
}

export function usePendingDocuments() {
  return useQuery({
    queryKey: [...KEY, 'pending'],
    queryFn: () => api<DocumentSummary[]>('/documents', { query: { status: 'pending' } }),
    refetchInterval: (query) => pollInterval(query.state.data),
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api<DocumentDetail>(`/documents/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data ? pollInterval([query.state.data]) : false),
  });
}

export interface UploadInput {
  kind: UploadableDocumentKind;
  accountId: string;
  files: File[];
}

export function useDocumentMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  return {
    upload: useMutation({
      mutationFn: (input: UploadInput) => {
        const formData = new FormData();
        formData.append('kind', input.kind);
        formData.append('accountId', input.accountId);
        for (const file of input.files) formData.append('files', file, file.name);
        return api<DocumentSummary>('/documents', { method: 'POST', formData });
      },
      onSuccess: refresh,
    }),
    /** Only reads the PDF's text on the server: nothing is stored yet. */
    previewStatement: useMutation({
      mutationFn: ({ file, password }: { file: File; password: string }) => {
        const formData = new FormData();
        formData.append('password', password);
        formData.append('file', file, file.name);
        return api<StatementPreview>('/documents/statement/preview', { method: 'POST', formData });
      },
    }),
    uploadStatement: useMutation({
      mutationFn: (input: StatementUpload) =>
        api<DocumentSummary>('/documents/statement', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    retry: useMutation({
      mutationFn: (id: string) => api<DocumentSummary>(`/documents/${id}/retry`, { method: 'POST' }),
      onSuccess: refresh,
    }),
    discard: useMutation({
      mutationFn: (id: string) => api<void>(`/documents/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    confirm: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DocumentConfirm }) =>
        api<DocumentConfirmResult>(`/documents/${id}/confirm`, { method: 'POST', body: input }),
      // New transactions and possibly new rules: everything on screen may be stale.
      onSuccess: () => client.invalidateQueries(),
    }),
  };
}
