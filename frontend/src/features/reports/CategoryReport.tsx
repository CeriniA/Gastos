import {
  CATEGORY_KINDS,
  formatMoney,
  type CategoryAmount,
  type CurrencyCategoryReport,
  type KindReport,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Card, Notice } from '../../shared/ui/ui';
import { MonthNav } from './MonthNav';
import { ShareRow } from './ShareRow';
import { useCategoryReport } from './api';

/** A category and, when opened, its subcategories, each as a share of the kind's total. */
function CategoryRow({
  amount,
  report,
  currency,
}: {
  amount: CategoryAmount;
  report: KindReport;
  currency: string;
}) {
  // What sits on the category itself, when it also has subcategories, is one more line.
  const ownCents = amount.totalCents - amount.children.reduce((sum, child) => sum + child.totalCents, 0);
  const row = { totalCents: report.totalCents, currency, tone: report.kind };
  return (
    <ShareRow label={amount.name || es.transactions.noCategory} cents={amount.totalCents} {...row}>
      {amount.children.length === 0 ? undefined : (
        <div className="mb-2 ml-4 border-l border-line pl-3">
          {amount.children.map((child) => (
            <CategoryRow key={child.categoryId} amount={child} report={report} currency={currency} />
          ))}
          {ownCents === 0 ? null : (
            <ShareRow label={es.reports.directly(amount.name)} cents={ownCents} {...row} />
          )}
        </div>
      )}
    </ShareRow>
  );
}

function KindCard({ report, currency }: { report: KindReport; currency: string }) {
  if (report.categories.length === 0) return null;
  return (
    <Card>
      <p className="text-sm text-muted">{es.reports.totalIn(es.kinds[report.kind], currency)}</p>
      <p className="amount mb-2 text-3xl font-bold tracking-tight">
        {formatMoney(report.totalCents, currency)}
      </p>
      {report.categories.map((amount) => (
        <CategoryRow key={amount.categoryId ?? 'none'} amount={amount} report={report} currency={currency} />
      ))}
    </Card>
  );
}

function CurrencyReport({ entry }: { entry: CurrencyCategoryReport }) {
  return (
    <>
      {CATEGORY_KINDS.map((kind) => (
        <KindCard key={kind} report={entry[kind]} currency={entry.currency} />
      ))}
    </>
  );
}

/** What came in and what went out in a month, by category. */
export function CategoryReport({ month, onMonth }: { month: string; onMonth: (month: string) => void }) {
  const report = useCategoryReport(month);
  return (
    <>
      <MonthNav month={month} onChange={onMonth} />
      <QueryState query={report}>
        {(data) =>
          data.currencies.length === 0 ? (
            <Notice>{es.reports.empty}</Notice>
          ) : (
            <div className="space-y-4">
              {data.currencies.map((entry) => (
                <CurrencyReport key={entry.currency} entry={entry} />
              ))}
              <p className="text-sm text-muted">{es.reports.scope}</p>
            </div>
          )
        }
      </QueryState>
    </>
  );
}
