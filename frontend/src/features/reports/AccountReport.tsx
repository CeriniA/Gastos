import { DEFAULT_TIMEZONE, formatDate, formatMoney, todayIso, type AccountActivity } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice } from '../../shared/ui/ui';
import { MonthNav } from './MonthNav';
import { ConsolidationNotice } from './ShowIn';
import { useAccountReport, type MonthReportProps } from './api';

const LINES = [
  ['incomeCents', es.reports.accounts.income, 'text-income'],
  ['expenseCents', es.reports.accounts.expense, 'text-expense'],
  ['transfersInCents', es.reports.accounts.transfersIn, ''],
  ['transfersOutCents', es.reports.accounts.transfersOut, ''],
] as const;

/** One account: what it had at the end of the month, and what went in and out of it. */
function AccountCard({ entry, balanceLabel }: { entry: AccountActivity; balanceLabel: string }) {
  const lines = LINES.filter(([field]) => entry[field] !== 0);
  const balance = entry.closingBalanceCents;
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 break-words font-semibold">{entry.name}</h2>
        {balance === null ? null : (
          <span className={`amount shrink-0 text-lg font-bold ${balance < 0 ? 'text-expense' : ''}`}>
            {formatMoney(balance, entry.currency)}
          </span>
        )}
      </div>
      <p className="mb-2 text-sm text-muted">
        {balance === null ? es.reports.accounts.balanceUnknown : balanceLabel}
      </p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted">{es.reports.accounts.noMovements}</p>
      ) : (
        <dl className="space-y-1 border-t border-line pt-2">
          {lines.map(([field, label, tone]) => (
            <div key={field} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className={`amount font-semibold ${tone}`}>{formatMoney(entry[field], entry.currency)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/** Each account in a month: its balance at the end, and what went in and out of it. */
export function AccountReport({ month, onMonth, showIn }: MonthReportProps) {
  const report = useAccountReport(month, showIn);
  return (
    <>
      <MonthNav month={month} onChange={onMonth} />
      <QueryState query={report}>
        {(data) => {
          const balanceLabel =
            data.balanceOn === todayIso(DEFAULT_TIMEZONE)
              ? es.reports.accounts.balanceToday
              : es.reports.accounts.balanceOn(formatDate(data.balanceOn));
          return (
            <div className="space-y-3">
              {data.accounts.length === 0 && !data.consolidated?.leftOut ? (
                <Notice>{es.reports.accounts.empty}</Notice>
              ) : null}
              {data.accounts.map((entry) => (
                <AccountCard key={entry.accountId} entry={entry} balanceLabel={balanceLabel} />
              ))}
              <ConsolidationNotice consolidated={data.consolidated} />
              <p className="text-sm text-muted">{es.reports.accounts.scope}</p>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
