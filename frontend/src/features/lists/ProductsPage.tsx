import { productCreateSchema, type Product } from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { useProductMutations, useProducts } from './api';
import { ListPage, type ListEntry } from './ListPage';

const toEntry = (product: Product): ListEntry => product;

export function ProductsPage() {
  const products = useProducts();
  const { create, update, remove, merge } = useProductMutations();
  return (
    <ListPage
      texts={es.lists.products}
      categoryRequired
      query={{ ...products, data: products.data?.map(toEntry) }}
      busy={create.isPending || update.isPending || remove.isPending || merge.isPending}
      validate={(draft) => (productCreateSchema.safeParse(draft).success ? null : fieldMessage('required'))}
      create={({ categoryId, ...draft }) => create.mutateAsync({ ...draft, categoryId: categoryId ?? '' })}
      remove={(id) => remove.mutateAsync(id)}
      merge={(id, targetId) => merge.mutateAsync({ id, targetId })}
      update={(id, { categoryId, ...changes }) =>
        update.mutateAsync({
          id,
          changes: { ...changes, ...(categoryId ? { categoryId } : {}) },
        })
      }
    />
  );
}
