import { Link } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  formatMoney,
  formatMonth,
  monthKeyOf,
  todayIso,
  type CurrencyTotals,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { TransactionRow } from '../transactions/TransactionRow';
import { useMonthSummary, useTransactions } from '../transactions/api';

/**
 * One currency's month: the balance, and a bar whose two parts are as wide
 * as income and expense are large, so the month reads at a glance.
 */
function MonthBalance({ totals }: { totals: CurrencyTotals }) {
  const volume = totals.incomeCents + totals.expenseCents;
  const incomeShare = volume === 0 ? 50 : Math.round((totals.incomeCents / volume) * 100);
  const positive = totals.balanceCents >= 0;
  return (
    <Card>
      <p className="text-sm text-muted">
        {es.home.balance} {totals.currency}
      </p>
      <p className={`amount text-4xl font-bold tracking-tight ${positive ? 'text-income' : 'text-expense'}`}>
        {formatMoney(totals.balanceCents, totals.currency)}
      </p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="bg-income" style={{ width: `${incomeShare}%` }} />
        <div className="bg-expense" style={{ width: `${100 - incomeShare}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-sm text-muted">{es.home.income}</dt>
          <dd className="amount font-semibold text-income">
            {formatMoney(totals.incomeCents, totals.currency)}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-sm text-muted">{es.home.expense}</dt>
          <dd className="amount font-semibold text-expense">
            {formatMoney(totals.expenseCents, totals.currency)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export function HomePage() {
  const month = monthKeyOf(todayIso(DEFAULT_TIMEZONE));
  const summary = useMonthSummary(month);
  const recent = useTransactions({ pageSize: 5 });
  const accounts = useAccounts();
  const categories = useCategories();

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight first-letter:uppercase">{formatMonth(month)}</h1>

      <QueryState query={summary}>
        {(data) =>
          data.totals.length === 0 ? (
            <Notice>{es.home.emptyMonth}</Notice>
          ) : (
            <div className="space-y-3">
              {data.totals.map((totals) => (
                <MonthBalance key={totals.currency} totals={totals} />
              ))}
            </div>
          )
        }
      </QueryState>

      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{es.home.recent}</h2>
        <Link to="/movimientos" className="text-sm font-semibold text-income">
          {es.home.seeAll}
        </Link>
      </div>
      <QueryState
        query={{ ...recent, data: recent.data?.items }}
        empty={
          <Link to="/movimientos/nuevo" className="font-semibold text-income">
            {es.home.addFirst}
          </Link>
        }
      >
        {(items) => (
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
        )}
      </QueryState>
    </>
  );
}
