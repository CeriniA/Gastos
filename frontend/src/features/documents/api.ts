import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentConfirm,
  DocumentConfirmResult,
  DocumentDetail,
  DocumentSummary,
  UploadableDocumentKind,
} from '@gastos/shared';
import { api } from '../../shared/api/client';

const KEY = ['documents'] as const;
/** How often to ask again while the AI is still reading. */
const POLL_MS = 3_000;

export function usePendingDocuments() {
  return useQuery({
    queryKey: [...KEY, 'pending'],
    queryFn: () => api<DocumentSummary[]>('/documents', { query: { status: 'pending' } }),
    refetchInterval: (query) =>
      query.state.data?.some((document) => document.status === 'processing') ? POLL_MS : false,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api<DocumentDetail>(`/documents/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? POLL_MS : false),
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
