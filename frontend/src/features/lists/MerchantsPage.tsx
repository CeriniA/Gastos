import { merchantCreateSchema, type Merchant } from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { useMerchantMutations, useMerchants } from './api';
import { ListPage, type ListEntry } from './ListPage';

const toEntry = (merchant: Merchant): ListEntry => ({ ...merchant, categoryId: merchant.defaultCategoryId });

export function MerchantsPage() {
  const merchants = useMerchants();
  const { create, update, remove, merge } = useMerchantMutations();
  return (
    <ListPage
      texts={es.lists.merchants}
      categoryRequired={false}
      query={{ ...merchants, data: merchants.data?.map(toEntry) }}
      busy={create.isPending || update.isPending || remove.isPending || merge.isPending}
      validate={(draft) =>
        merchantCreateSchema.safeParse({ ...draft, defaultCategoryId: draft.categoryId }).success
          ? null
          : fieldMessage('required')
      }
      create={({ categoryId, ...draft }) => create.mutateAsync({ ...draft, defaultCategoryId: categoryId })}
      remove={(id) => remove.mutateAsync(id)}
      merge={(id, targetId) => merge.mutateAsync({ id, targetId })}
      update={(id, { categoryId, ...changes }) =>
        update.mutateAsync({
          id,
          changes: { ...changes, ...(categoryId === undefined ? {} : { defaultCategoryId: categoryId }) },
        })
      }
    />
  );
}
