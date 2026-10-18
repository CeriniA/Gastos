import { formatDate, formatMoney, type Account, type Category, type Transaction } from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { useAction } from '../../shared/ui/useAction';
import { Button, Loading, Notice, PageTitle } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { useTransactionMutations, useTransactionPages } from './api';

function TrashRow({
  transaction,
  accounts,
  categories,
  busy,
  onRestore,
  onDelete,
}: {
  transaction: Transaction;
  accounts: readonly Account[];
  categories: readonly Category[];
  busy: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const account = accounts.find((candidate) => candidate.id === transaction.accountId);
  const category = categories.find((candidate) => candidate.id === transaction.categoryId);
  const title = transaction.description || category?.name || es.types[transaction.type];
  const details = [formatDate(transaction.date), account?.name, es.types[transaction.type]].filter(Boolean);
  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block break-words font-medium">{title}</span>
          <span className="block text-sm text-muted">{details.join(', ')}</span>
        </span>
        <span className="amount shrink-0 font-semibold">
          {formatMoney(transaction.amountCents, transaction.currency)}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={onRestore}>
          {es.trash.restore}
        </Button>
        <Button variant="danger" className="flex-1" disabled={busy} onClick={onDelete}>
          {es.trash.deleteForever}
        </Button>
      </div>
    </li>
  );
}

/** What was deleted and can still be brought back, or removed for good. */
export function TrashPage() {
  const trash = useTransactionPages({ deleted: true });
  const accounts = useAccounts();
  const categories = useCategories();
  const { restore, removeForever, emptyTrash } = useTransactionMutations();
  const { failure, run } = useAction();
  const busy = restore.isPending || removeForever.isPending || emptyTrash.isPending;

  if (trash.isPending) return <Loading />;
  if (trash.error) return <Notice tone="error">{errorMessage(trash.error)}</Notice>;

  const items = trash.data.pages.flatMap((page) => page.items);
  const total = trash.data.pages[0]?.total ?? 0;

  return (
    <>
      <PageTitle>{es.trash.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.trash.text}</p>

      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      {items.length === 0 ? (
        <Notice>{es.trash.empty}</Notice>
      ) : (
        <>
          <ul className="mb-4 divide-y divide-line rounded-2xl bg-surface shadow-card">
            {items.map((transaction) => (
              <TrashRow
                key={transaction.id}
                transaction={transaction}
                accounts={accounts.data ?? []}
                categories={categories.data ?? []}
                busy={busy}
                onRestore={() => void run(() => restore.mutateAsync(transaction.id))}
                onDelete={() => {
                  if (window.confirm(es.trash.deleteConfirm)) {
                    void run(() => removeForever.mutateAsync(transaction.id));
                  }
                }}
              />
            ))}
          </ul>

          {trash.hasNextPage ? (
            <Button
              variant="secondary"
              className="mb-4 w-full"
              disabled={trash.isFetchingNextPage}
              onClick={() => void trash.fetchNextPage()}
            >
              {es.transactions.loadMore}
            </Button>
          ) : null}

          <Button
            variant="danger"
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (window.confirm(es.trash.emptyConfirm(total))) void run(() => emptyTrash.mutateAsync());
            }}
          >
            {es.trash.emptyAction(total)}
          </Button>
        </>
      )}
    </>
  );
}
