import { formatMoney, type CurrencyMerchants } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice } from '../../shared/ui/ui';
import { MonthNav } from './MonthNav';
import { ConsolidationNotice } from './ShowIn';
import { ShareRow } from './ShareRow';
import { useMerchantReport, type MonthReportProps } from './api';

function CurrencyCard({ entry }: { entry: CurrencyMerchants }) {
  const row = { totalCents: entry.totalCents, currency: entry.currency, tone: 'expense' as const };
  return (
    <Card>
      <p className="text-sm text-muted">{es.reports.merchants.total(entry.currency)}</p>
      <p className="amount mb-2 text-3xl font-bold tracking-tight">
        {formatMoney(entry.totalCents, entry.currency)}
      </p>
      {entry.merchants.map((merchant) => (
        <ShareRow
          key={merchant.name}
          label={`${merchant.name} · ${es.reports.merchants.count(merchant.count)}`}
          cents={merchant.totalCents}
          {...row}
        />
      ))}
      {entry.othersCents === 0 ? null : (
        <ShareRow label={es.reports.merchants.others} cents={entry.othersCents} {...row} />
      )}
    </Card>
  );
}

/** Where the money of a month went, merchant by merchant. */
export function MerchantReport({ month, onMonth, showIn }: MonthReportProps) {
  const report = useMerchantReport(month, showIn);
  return (
    <>
      <MonthNav month={month} onChange={onMonth} />
      <QueryState query={report}>
        {(data) => (
          <div className="space-y-4">
            {data.currencies.length === 0 && !data.consolidated?.leftOut ? (
              <Notice>{es.reports.merchants.empty}</Notice>
            ) : null}
            {data.currencies.map((entry) => (
              <CurrencyCard key={entry.currency} entry={entry} />
            ))}
            <ConsolidationNotice consolidated={data.consolidated} />
            <p className="text-sm text-muted">{es.reports.merchants.scope}</p>
          </div>
        )}
      </QueryState>
    </>
  );
}
