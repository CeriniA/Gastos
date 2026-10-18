import type { ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Receipt,
  Repeat,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
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
import { Notice } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { driveBackupNeedsAttention, useDriveBackup } from '../data/api';
import { usePendingDocuments } from '../documents/api';
import { useCategories } from '../categories/api';
import { useRecurrings } from '../recurrings/api';
import { TransactionRow } from '../transactions/TransactionRow';
import { useMonthSummary, useTransactions } from '../transactions/api';
import { ICON_SIZE } from '../../shared/ui/icons';

/**
 * One currency's month: the balance in large, and what came in and went out
 * on two soft tiles beside each other, so the month reads at a glance.
 */
function MonthBalance({ totals, showCurrency }: { totals: CurrencyTotals; showCurrency: boolean }) {
  const tiles = [
    {
      label: es.home.income,
      cents: totals.incomeCents,
      icon: ArrowDownLeft,
      tone: 'bg-income-soft text-income',
    },
    {
      label: es.home.expense,
      cents: totals.expenseCents,
      icon: ArrowUpRight,
      tone: 'bg-expense-soft text-expense',
    },
  ] as const;
  return (
    <section>
      <p className="text-sm text-muted">
        {showCurrency ? es.home.balanceIn(totals.currency) : es.home.balance}
      </p>
      <p
        className={`amount mb-3 text-4xl font-bold tracking-tight ${totals.balanceCents < 0 ? 'text-expense' : ''}`}
      >
        {formatMoney(totals.balanceCents, totals.currency)}
      </p>
      <dl className="grid grid-cols-2 gap-3">
        {tiles.map(({ label, cents, icon: Icon, tone }) => (
          <div key={label} className={`rounded-2xl p-3 ${tone}`}>
            <Icon size={ICON_SIZE.regular} aria-hidden="true" />
            <dt className="mt-1 text-sm">{label}</dt>
            <dd className="amount font-semibold">{formatMoney(cents, totals.currency)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const BANNER_TONES = {
  primary: 'bg-primary-soft text-primary-ink',
  attention: 'bg-attention-soft text-ink',
  danger: 'bg-expense-soft text-expense',
} as const;

/** Something waiting for the user, with where to go to deal with it. */
function Banner({
  to,
  tone,
  icon: Icon,
  children,
}: {
  to: string;
  tone: keyof typeof BANNER_TONES;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`mb-3 flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 font-semibold ${BANNER_TONES[tone]}`}
    >
      <Icon size={ICON_SIZE.regular} className="shrink-0" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      <ChevronRight size={ICON_SIZE.chevron} className="shrink-0" aria-hidden="true" />
    </Link>
  );
}

export function HomePage() {
  const month = monthKeyOf(todayIso(DEFAULT_TIMEZONE));
  const summary = useMonthSummary(month);
  const recent = useTransactions({ pageSize: 5 });
  const accounts = useAccounts();
  const categories = useCategories();
  const pending = usePendingDocuments();
  const pendingCount = pending.data?.length ?? 0;
  const driveBackup = useDriveBackup();
  const recurrings = useRecurrings();
  const fixedAttention =
    recurrings.data?.items.filter((item) => item.state === 'late' || item.state === 'changed').length ?? 0;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight first-letter:uppercase">{formatMonth(month)}</h1>

      {pendingCount > 0 ? (
        <Banner to="/pendientes" tone="primary" icon={Receipt}>
          {es.documents.banner(pendingCount)}
        </Banner>
      ) : null}
      {fixedAttention > 0 ? (
        <Banner to="/mas/fijos" tone="attention" icon={Repeat}>
          {es.recurrings.attention(fixedAttention)}
        </Banner>
      ) : null}
      {driveBackupNeedsAttention(driveBackup.data) ? (
        <Banner to="/mas/datos" tone="danger" icon={TriangleAlert}>
          {es.data.drive.attention}
        </Banner>
      ) : null}

      <QueryState query={summary}>
        {(data) =>
          data.totals.length === 0 ? (
            <Notice>{es.home.emptyMonth}</Notice>
          ) : (
            <div className="mt-2 space-y-6">
              {data.totals.map((totals) => (
                <MonthBalance key={totals.currency} totals={totals} showCurrency={data.totals.length > 1} />
              ))}
            </div>
          )
        }
      </QueryState>

      <div className="mb-2 mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{es.home.recent}</h2>
        <Link to="/movimientos" className="text-sm font-semibold text-primary">
          {es.home.seeAll}
        </Link>
      </div>
      <QueryState
        query={{ ...recent, data: recent.data?.items }}
        empty={
          <Link to="/movimientos/nuevo" className="font-semibold text-primary">
            {es.home.addFirst}
          </Link>
        }
      >
        {(items) => (
          <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
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
