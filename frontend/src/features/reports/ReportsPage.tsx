import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  addMonthsToKey,
  formatDate,
  formatMoney,
  formatMonth,
  monthKeyOf,
  todayIso,
  type ConsumptionItem,
  type CurrencyConsumption,
  type GroupConsumption,
  type ProductGroup,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { useDebounced } from '../../shared/ui/useDebounced';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice, PageTitle, TextInput } from '../../shared/ui/ui';
import { useConsumptionSearch, useConsumptionSummary } from './api';

function groupLabel(group: ProductGroup | null): string {
  return group ? es.productGroups[group] : es.consumption.ungrouped;
}

function formatQuantity(quantity: number): string {
  return quantity.toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

/** One group: its share of the total as a bar, and its products when opened. */
function GroupRow({
  group,
  currency,
  totalCents,
}: {
  group: GroupConsumption;
  currency: string;
  totalCents: number;
}) {
  const share = totalCents === 0 ? 0 : Math.round((group.totalCents / totalCents) * 100);
  return (
    <details className="border-t border-line first:border-t-0">
      <summary className="cursor-pointer px-1 py-3">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 font-medium">{groupLabel(group.group)}</span>
          <span className="amount shrink-0 font-semibold">{formatMoney(group.totalCents, currency)}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="block h-full bg-expense" style={{ width: `${share}%` }} />
          </span>
          <span className="w-10 shrink-0 text-right text-sm text-muted">{share}%</span>
        </span>
      </summary>
      <ul className="mb-2 divide-y divide-line rounded-lg border border-line text-sm">
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
            <span className="amount shrink-0">{formatMoney(product.totalCents, currency)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
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
        <GroupRow
          key={group.group ?? 'none'}
          group={group}
          currency={entry.currency}
          totalCents={entry.totalCents}
        />
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

/**
 * Consumption: what was bought, from the product lines of the receipts. The
 * other reports (by category, by account, month by month) are stage 4.
 */
export function ReportsPage() {
  const currentMonth = monthKeyOf(todayIso(DEFAULT_TIMEZONE));
  const [month, setMonth] = useState(currentMonth);
  const [text, setText] = useState('');

  const searched = useDebounced(text.trim());

  const summary = useConsumptionSummary(month);
  const search = useConsumptionSearch(searched);
  const searching = searched.length >= 2;

  return (
    <>
      <PageTitle>{es.consumption.title}</PageTitle>

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
          <nav className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-lg border border-line bg-surface text-xl"
              aria-label={es.consumption.previousMonth}
              onClick={() => setMonth(addMonthsToKey(month, -1))}
            >
              ‹
            </button>
            <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-lg border border-line bg-surface text-xl disabled:opacity-40"
              aria-label={es.consumption.nextMonth}
              disabled={month >= currentMonth}
              onClick={() => setMonth(addMonthsToKey(month, 1))}
            >
              ›
            </button>
          </nav>

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
