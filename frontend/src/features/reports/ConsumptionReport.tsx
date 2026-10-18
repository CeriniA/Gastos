import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDate,
  formatMoney,
  formatQuantity,
  type ConsumptionItem,
  type CurrencyConsumption,
  type ProductGroup,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { useDebounced } from '../../shared/ui/useDebounced';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice, TextInput } from '../../shared/ui/ui';
import { MonthNav } from '../../shared/ui/MonthNav';
import { ShareRow } from './ShareRow';
import { useConsumptionSearch, useConsumptionSummary } from './api';

/** Fewer letters than this find too much to be a search. */
const MIN_SEARCH_LENGTH = 2;

function groupLabel(group: ProductGroup | null): string {
  return group ? es.productGroups[group] : es.consumption.ungrouped;
}

function CurrencyCard({ entry }: { entry: CurrencyConsumption }) {
  return (
    <Card>
      <p className="text-sm text-muted">
        {es.consumption.total} {entry.currency}
      </p>
      <p className="amount mb-2 text-3xl font-bold tracking-tight">
        {formatMoney(entry.totalCents, entry.currency)}
      </p>
      {entry.groups.map((group) => (
        <ShareRow
          key={group.group ?? 'none'}
          label={groupLabel(group.group)}
          cents={group.totalCents}
          totalCents={entry.totalCents}
          currency={entry.currency}
          tone="expense"
        >
          <ul className="mb-2 divide-y divide-line rounded-2xl border border-line text-sm">
            {group.products.map((product) => (
              <li key={product.product} className="flex justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block break-words">{product.product}</span>
                  <span className="block text-muted">
                    {es.consumption.purchases(product.purchases)}
                    {product.quantity !== null
                      ? ` · ${es.consumption.quantity(formatQuantity(product.quantity))}`
                      : ''}
                  </span>
                </span>
                <span className="amount shrink-0">{formatMoney(product.totalCents, entry.currency)}</span>
              </li>
            ))}
          </ul>
        </ShareRow>
      ))}
    </Card>
  );
}

function SearchResults({ items }: { items: ConsumptionItem[] }) {
  if (items.length === 0) return <Notice>{es.consumption.searchEmpty}</Notice>;
  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {items.map((item, position) => (
          <li key={`${item.transactionId}-${position}`}>
            <Link
              to={`/movimientos/${item.transactionId}`}
              className="flex justify-between gap-3 px-4 py-2.5"
            >
              <span className="min-w-0">
                <span className="block break-words font-medium">{item.product || item.name}</span>
                <span className="block break-words text-sm text-muted">
                  {formatDate(item.date)}
                  {item.description ? ` · ${item.description}` : ''}
                  {item.quantity !== null
                    ? ` · ${es.consumption.quantity(formatQuantity(item.quantity))}`
                    : ''}
                </span>
                {item.product && item.name !== item.product ? (
                  <span className="block break-words text-sm text-muted">{item.name}</span>
                ) : null}
              </span>
              <span className="amount shrink-0">{formatMoney(item.amountCents, item.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Consumption: what was bought, from the product lines of the receipts. */
export function ConsumptionReport({ month, onMonth }: { month: string; onMonth: (month: string) => void }) {
  const [text, setText] = useState('');
  const searched = useDebounced(text.trim());
  const summary = useConsumptionSummary(month);
  const search = useConsumptionSearch(searched);
  const searching = searched.length >= MIN_SEARCH_LENGTH;

  return (
    <>
      <div className="mb-4">
        <TextInput
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={es.consumption.searchPlaceholder}
          aria-label={es.consumption.searchPlaceholder}
        />
      </div>

      {searching ? (
        <QueryState query={search}>{(items) => <SearchResults items={items} />}</QueryState>
      ) : (
        <>
          <MonthNav month={month} onChange={onMonth} />
          <QueryState query={summary}>
            {(data) =>
              data.currencies.length === 0 ? (
                <Notice>{es.consumption.empty}</Notice>
              ) : (
                <div className="space-y-4">
                  {data.currencies.map((entry) => (
                    <CurrencyCard key={entry.currency} entry={entry} />
                  ))}
                  <p className="text-sm text-muted">{es.consumption.scope}</p>
                </div>
              )
            }
          </QueryState>
        </>
      )}
    </>
  );
}
