import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryRule, DocumentSummary, ProductRule } from '@gastos/shared';
import { api } from '../../shared/api/client';

const CATEGORY_RULES = ['category-rules'] as const;
const PRODUCT_RULES = ['product-rules'] as const;
// Under 'documents', so a confirmation elsewhere refreshes this list too.
const DOCUMENTS = ['documents', 'all'] as const;

export function useCategoryRules() {
  return useQuery({ queryKey: CATEGORY_RULES, queryFn: () => api<CategoryRule[]>('/category-rules') });
}

export function useProductRules() {
  return useQuery({ queryKey: PRODUCT_RULES, queryFn: () => api<ProductRule[]>('/product-rules') });
}

/** Documents already confirmed: kept, without images, so the same file is not counted twice. */
export function useConfirmedDocuments() {
  return useQuery({
    queryKey: DOCUMENTS,
    queryFn: () => api<DocumentSummary[]>('/documents', { query: { status: 'all' } }),
    select: (documents) => documents.filter((document) => document.status === 'confirmed'),
  });
}

/** What happens to a confirmed document's transactions when it is deleted. */
export type DocumentTransactions = 'keep' | 'delete';

export function useRememberedMutations() {
  const client = useQueryClient();
  return {
    forgetCategoryRule: useMutation({
      mutationFn: (id: string) => api<void>(`/category-rules/${id}`, { method: 'DELETE' }),
      onSuccess: () => client.invalidateQueries({ queryKey: CATEGORY_RULES }),
    }),
    forgetProductRule: useMutation({
      mutationFn: (id: string) => api<void>(`/product-rules/${id}`, { method: 'DELETE' }),
      onSuccess: () => client.invalidateQueries({ queryKey: PRODUCT_RULES }),
    }),
    /** Deleting its transactions too changes balances and reports: everything is asked again. */
    removeDocument: useMutation({
      mutationFn: ({ id, transactions }: { id: string; transactions: DocumentTransactions }) =>
        api<void>(`/documents/${id}`, { method: 'DELETE', query: { transactions } }),
      onSuccess: () => client.invalidateQueries(),
    }),
  };
}
