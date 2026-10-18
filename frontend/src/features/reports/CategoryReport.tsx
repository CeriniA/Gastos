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
import { MonthNav } from '../../shared/ui/MonthNav';
import { categoryLook } from '../../shared/ui/categoryLook';
import { useCategories } from '../categories/api';
import { ShareRow } from './ShareRow';

/** Expenses first: they are what a month's report is mostly read for. */
const KIND_ORDER = [...CATEGORY_KINDS].reverse();
import { ConsolidationNotice } from './ShowIn';
import { useCategoryReport, type MonthReportProps } from './api';

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
  const categories = useCategories();
  return (
    <ShareRow
      label={amount.name || es.transactions.noCategory}
      cents={amount.totalCents}
      look={categoryLook(amount.categoryId, categories.data ?? [])}
      {...row}
    >
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
      {KIND_ORDER.map((kind) => (
        <KindCard key={kind} report={entry[kind]} currency={entry.currency} />
      ))}
    </>
  );
}

/** What came in and what went out in a month, by category. */
export function CategoryReport({ month, onMonth, showIn }: MonthReportProps) {
  const report = useCategoryReport(month, showIn);
  return (
    <>
      <MonthNav month={month} onChange={onMonth} />
      <QueryState query={report}>
        {(data) =>
          data.currencies.length === 0 ? (
            <div className="space-y-3">
              {data.consolidated?.leftOut ? null : <Notice>{es.reports.empty}</Notice>}
              <ConsolidationNotice consolidated={data.consolidated} />
            </div>
          ) : (
            <div className="space-y-4">
              {data.currencies.map((entry) => (
                <CurrencyReport key={entry.currency} entry={entry} />
              ))}
              <ConsolidationNotice consolidated={data.consolidated} />
              <p className="text-sm text-muted">{es.reports.scope}</p>
            </div>
          )
        }
      </QueryState>
    </>
  );
}
