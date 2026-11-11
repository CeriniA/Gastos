import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Merchant,
  MerchantCreate,
  MerchantUpdate,
  Product,
  ProductCreate,
  ProductUpdate,
} from '@gastos/shared';
import { api } from '../../shared/api/client';

/** Merchants and products are lists with the same calls; only the path and the data change. */
function listApi<Item, Create, Update>(path: string) {
  const key = [path] as const;
  return {
    useList: () => useQuery({ queryKey: key, queryFn: () => api<Item[]>(path) }),
    useMutations: () => {
      const client = useQueryClient();
      // A merchant or product renamed or archived changes what reports and movements show.
      const refresh = () => client.invalidateQueries();
      return {
        create: useMutation({
          mutationFn: (input: Create) => api<Item>(path, { method: 'POST', body: input }),
          onSuccess: refresh,
        }),
        update: useMutation({
          mutationFn: ({ id, changes }: { id: string; changes: Update }) =>
            api<Item>(`${path}/${id}`, { method: 'PATCH', body: changes }),
          onSuccess: refresh,
        }),
      };
    },
  };
}

const merchants = listApi<Merchant, MerchantCreate, MerchantUpdate>('/merchants');
const products = listApi<Product, ProductCreate, ProductUpdate>('/products');

export const useMerchants = merchants.useList;
export const useMerchantMutations = merchants.useMutations;
export const useProducts = products.useList;
export const useProductMutations = products.useMutations;
