import {
  DEFAULT_EVOLUTION_MONTHS,
  formatMoney,
  formatMonth,
  type Currency,
  type EvolutionReport as Evolution,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice } from '../../shared/ui/ui';
import { MonthNav } from './MonthNav';
import { ConsolidationNotice } from './ShowIn';
import { useEvolution, type MonthReportProps } from './api';

const PERCENT = 100;

/** One bar, as long as its amount is against the largest month of the card. */
function Bar({ cents, largest, tone }: { cents: number; largest: number; tone: string }) {
  const width = largest <= 0 ? 0 : Math.max(0, Math.round((cents / largest) * PERCENT));
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
      <span className={`block h-full ${tone}`} style={{ width: `${width}%` }} />
    </span>
  );
}

/** One currency's months, newest first, each with its income and expenses side by side. */
function CurrencyCard({ data, currency }: { data: Evolution; currency: Currency }) {
  const months = data.months
    .map((entry) => ({
      month: entry.month,
      totals: entry.totals.find((totals) => totals.currency === currency),
    }))
    .reverse();
  const largest = Math.max(
    ...months.map(({ totals }) => Math.max(totals?.incomeCents ?? 0, totals?.expenseCents ?? 0)),
  );
  const withData = months.filter(({ totals }) => totals);
  const spent = withData.reduce((total, { totals }) => total + (totals?.expenseCents ?? 0), 0);
  const average = Math.round(spent / Math.max(withData.length, 1));

  return (
    <Card>
      <p className="text-sm text-muted">
        {es.reports.evolution.months(data.months.length)} · {currency}
      </p>
      <p className="mb-3 text-sm text-muted">
        {es.reports.evolution.average(formatMoney(average, currency))}
      </p>
      <ul className="space-y-3">
        {months.map(({ month, totals }) => (
          <li key={month}>
            <p className="mb-1 flex items-baseline justify-between gap-3">
              <span className="font-medium first-letter:uppercase">{formatMonth(month)}</span>
              {totals ? (
                <span
                  className={`amount text-sm font-semibold ${totals.balanceCents >= 0 ? 'text-income' : 'text-expense'}`}
                >
                  {formatMoney(totals.balanceCents, currency)}
                </span>
              ) : (
                <span className="text-sm text-muted">{es.reports.evolution.noData}</span>
              )}
            </p>
            {totals ? (
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                <Bar cents={totals.incomeCents} largest={largest} tone="bg-income" />
                <span className="amount text-right">{formatMoney(totals.incomeCents, currency)}</span>
                <Bar cents={totals.expenseCents} largest={largest} tone="bg-expense" />
                <span className="amount text-right">{formatMoney(totals.expenseCents, currency)}</span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Income and expenses of the last months, up to the one chosen. */
export function EvolutionReport({ month, onMonth, showIn }: MonthReportProps) {
  const report = useEvolution(month, DEFAULT_EVOLUTION_MONTHS, showIn);
  return (
    <>
      <MonthNav month={month} onChange={onMonth} />
      <QueryState query={report}>
        {(data) => {
          const currencies = [
            ...new Set(data.months.flatMap((entry) => entry.totals.map((totals) => totals.currency))),
          ].sort();
          return (
            <div className="space-y-4">
              {currencies.length === 0 && !data.consolidated?.leftOut ? (
                <Notice>{es.reports.evolution.empty}</Notice>
              ) : null}
              {currencies.map((currency) => (
                <CurrencyCard key={currency} data={data} currency={currency} />
              ))}
              <ConsolidationNotice consolidated={data.consolidated} />
              <p className="text-sm text-muted">{es.reports.scope}</p>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
