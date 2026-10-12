import { useState } from 'react';
import {
  CATEGORY_KINDS,
  DEFAULT_TIMEZONE,
  TRANSACTION_TYPES,
  addMonthsToKey,
  formatMonth,
  monthKeyOf,
  todayIso,
  type CategoryKind,
  type TransactionType,
} from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { useDebounced } from '../../shared/ui/useDebounced';
import { Button, Field, Loading, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { useTags } from '../tags/api';
import { TransactionRow } from './TransactionRow';
import { useTransactionPages } from './api';

interface Filters {
  type: TransactionType | '';
  accountId: string;
  categoryId: string;
  tagId: string;
}

const NO_FILTERS: Filters = { type: '', accountId: '', categoryId: '', tagId: '' };

export function TransactionsPage() {
  const [month, setMonth] = useState(() => monthKeyOf(todayIso(DEFAULT_TIMEZONE)));
  const [allTime, setAllTime] = useState(false);
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState(false);

  const searched = useDebounced(text.trim());

  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const transactions = useTransactionPages({
    month: allTime ? undefined : month,
    q: searched || undefined,
    type: filters.type || undefined,
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    tagId: filters.tagId || undefined,
  });

  const activeFilters = Object.values(filters).filter(Boolean).length + (allTime ? 1 : 0);
  const narrowed = activeFilters > 0 || searched !== '';
  const set = (changes: Partial<Filters>) => setFilters((current) => ({ ...current, ...changes }));
  const clear = () => {
    setFilters(NO_FILTERS);
    setAllTime(false);
    setText('');
  };

  // A category belongs to one kind, so the list follows the type filter.
  const kinds: readonly CategoryKind[] =
    filters.type === 'transfer' ? [] : filters.type ? [filters.type] : CATEGORY_KINDS;
  const categoryOptions = kinds.flatMap((kind) => orderedTree(categories.data ?? [], kind));

  const items = transactions.data?.pages.flatMap((page) => page.items) ?? [];
  const total = transactions.data?.pages[0]?.total ?? 0;

  return (
    <>
      <PageTitle>{es.transactions.title}</PageTitle>

      <div className="mb-3 flex gap-2">
        <TextInput
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={es.transactions.filters.search}
          aria-label={es.transactions.filters.search}
        />
        <Button variant="secondary" className="shrink-0" aria-expanded={open} onClick={() => setOpen(!open)}>
          {es.transactions.filters.toggle(activeFilters)}
        </Button>
      </div>

      {open ? (
        <div className="mb-3 space-y-3 rounded-xl border border-line bg-surface p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={es.transactions.fields.type}>
              <Select
                value={filters.type}
                onChange={(event) => set({ type: event.target.value as Filters['type'], categoryId: '' })}
              >
                <option value="">{es.transactions.filters.all}</option>
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {es.types[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={es.transactions.fields.account}>
              <Select value={filters.accountId} onChange={(event) => set({ accountId: event.target.value })}>
                <option value="">{es.transactions.filters.allFeminine}</option>
                {(accounts.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={es.transactions.fields.category} hint={es.transactions.filters.categoryHint}>
            <Select
              value={filters.categoryId}
              disabled={filters.type === 'transfer'}
              onChange={(event) => set({ categoryId: event.target.value })}
            >
              <option value="">{es.transactions.filters.allFeminine}</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {optionLabel(category)}
                </option>
              ))}
            </Select>
          </Field>
          {(tags.data ?? []).length > 0 ? (
            <Field label={es.transactions.fields.tags}>
              <Select value={filters.tagId} onChange={(event) => set({ tagId: event.target.value })}>
                <option value="">{es.transactions.filters.allFeminine}</option>
                {(tags.data ?? []).map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={allTime}
              onChange={(event) => setAllTime(event.target.checked)}
            />
            {es.transactions.filters.allTime}
          </label>
          {narrowed ? (
            <Button variant="quiet" className="px-0" onClick={clear}>
              {es.transactions.filters.clear}
            </Button>
          ) : null}
        </div>
      ) : null}

      {allTime ? null : (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-surface">
          <Button
            variant="quiet"
            aria-label={es.transactions.previousMonth}
            onClick={() => setMonth(addMonthsToKey(month, -1))}
          >
            ‹
          </Button>
          <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
          <Button
            variant="quiet"
            aria-label={es.transactions.nextMonth}
            onClick={() => setMonth(addMonthsToKey(month, 1))}
          >
            ›
          </Button>
        </div>
      )}

      {transactions.isPending ? (
        <Loading />
      ) : transactions.error ? (
        <div className="space-y-3">
          <Notice tone="error">{errorMessage(transactions.error)}</Notice>
          <Button variant="secondary" onClick={() => void transactions.refetch()}>
            {es.common.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Notice>{narrowed ? es.transactions.filters.noResults : es.transactions.empty}</Notice>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">{es.transactions.count(total)}</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                accounts={accounts.data ?? []}
                categories={categories.data ?? []}
              />
            ))}
          </ul>
          {transactions.hasNextPage ? (
            <Button
              variant="secondary"
              className="mt-4 w-full"
              disabled={transactions.isFetchingNextPage}
              onClick={() => void transactions.fetchNextPage()}
            >
              {transactions.isFetchingNextPage ? es.common.loading : es.transactions.loadMore}
            </Button>
          ) : null}
        </>
      )}
    </>
  );
}
