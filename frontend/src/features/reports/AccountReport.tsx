import { formatMoney, type AccountActivity } from '@gastos/shared';
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

function AccountCard({ entry }: { entry: AccountActivity }) {
  return (
    <Card>
      <h2 className="mb-2 break-words font-semibold">{entry.name}</h2>
      <dl className="space-y-1">
        {LINES.filter(([field]) => entry[field] !== 0).map(([field, label, tone]) => (
          <div key={field} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className={`amount font-semibold ${tone}`}>{formatMoney(entry[field], entry.currency)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** What went in and out of each account in a month. */
export function AccountReport({ month, onMonth, showIn }: MonthReportProps) {
  const report = useAccountReport(month, showIn);
  return (
    <>
      <MonthNav month={month} onChange={onMonth} />
      <QueryState query={report}>
        {(data) => (
          <div className="space-y-3">
            {data.accounts.length === 0 && !data.consolidated?.leftOut ? (
              <Notice>{es.reports.accounts.empty}</Notice>
            ) : null}
            {data.accounts.map((entry) => (
              <AccountCard key={entry.accountId} entry={entry} />
            ))}
            <ConsolidationNotice consolidated={data.consolidated} />
            <p className="text-sm text-muted">{es.reports.accounts.scope}</p>
          </div>
        )}
      </QueryState>
    </>
  );
}
