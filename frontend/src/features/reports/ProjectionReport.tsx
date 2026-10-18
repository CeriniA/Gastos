import { Link } from 'react-router-dom';
import {
  formatDate,
  formatMoney,
  formatMonth,
  type ProjectedCurrency,
  type ProjectedMonth,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice } from '../../shared/ui/ui';
import { ConsolidationNotice } from './ShowIn';
import { useProjection, type ShowIn } from './api';

/** How a month would end in one currency, and what that is made of. */
function Totals({ entry }: { entry: ProjectedCurrency }) {
  const lines = [
    [es.reports.projection.confirmed, entry.confirmedIncomeCents, entry.confirmedExpenseCents],
    [es.reports.projection.expected, entry.expectedIncomeCents, entry.expectedExpenseCents],
  ] as const;
  return (
    <div className="mb-3">
      <p className="text-sm text-muted">
        {es.reports.projection.balance} · {entry.currency}
      </p>
      <p
        className={`amount mb-2 text-2xl font-bold tracking-tight ${entry.balanceCents >= 0 ? 'text-income' : 'text-expense'}`}
      >
        {formatMoney(entry.balanceCents, entry.currency)}
      </p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-sm">
        <span />
        <span className="text-right text-muted">{es.home.income}</span>
        <span className="text-right text-muted">{es.home.expense}</span>
        {lines.map(([label, income, expense]) => (
          <div key={label} className="contents">
            <span className="text-muted">{label}</span>
            <span className="amount text-right text-income">{formatMoney(income, entry.currency)}</span>
            <span className="amount text-right text-expense">{formatMoney(expense, entry.currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthCard({ month }: { month: ProjectedMonth }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold first-letter:uppercase">{formatMonth(month.month)}</h2>
      {month.currencies.length === 0 ? <Notice>{es.reports.projection.empty}</Notice> : null}
      {month.currencies.map((entry) => (
        <Totals key={entry.currency} entry={entry} />
      ))}
      {month.entries.length === 0 ? null : (
        <>
          <h3 className="mb-1 mt-2 text-sm font-semibold text-muted">{es.reports.projection.entries}</h3>
          <ul className="divide-y divide-line">
            {month.entries.map((entry, index) => (
              <li key={index} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block break-words font-medium">
                    {entry.name || es.transactions.noDescription}
                  </span>
                  <span className="block text-sm text-muted">
                    {[
                      es.reports.projection.kinds[entry.kind],
                      entry.installment
                        ? es.transactions.installment(entry.installment.number, entry.installment.total)
                        : null,
                      formatDate(entry.date),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span
                  className={`amount shrink-0 font-semibold ${entry.type === 'income' ? 'text-income' : 'text-expense'}`}
                >
                  {formatMoney(entry.cents, entry.currency)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** This month and the next ones: what is loaded, plus installments and fixed items to come. */
export function ProjectionReport({ showIn }: { showIn: ShowIn }) {
  const report = useProjection(showIn);
  return (
    <QueryState query={report}>
      {(data) => {
        const anyFixed = data.months.some((month) =>
          month.entries.some((entry) => entry.kind === 'recurring'),
        );
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted">{es.reports.projection.text}</p>
            {data.months.map((month) => (
              <MonthCard key={month.month} month={month} />
            ))}
            <ConsolidationNotice consolidated={data.consolidated} />
            {anyFixed ? null : (
              <p className="text-sm text-muted">
                {es.reports.projection.noFixed}{' '}
                <Link to="/mas/fijos" className="font-semibold text-primary">
                  {es.reports.projection.goFixed}
                </Link>
              </p>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
