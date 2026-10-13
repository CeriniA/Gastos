import { useState } from 'react';
import { DEFAULT_TIMEZONE, monthKeyOf, todayIso } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { PageTitle, Tabs } from '../../shared/ui/ui';
import { CategoryReport } from './CategoryReport';
import { ConsumptionReport } from './ConsumptionReport';

const REPORTS = ['categories', 'consumption'] as const;
type Report = (typeof REPORTS)[number];

/**
 * The reports, one per tab, all on the same month. By account, month by month
 * and by merchant are still to come (stage 4).
 */
export function ReportsPage() {
  const [report, setReport] = useState<Report>('categories');
  const [month, setMonth] = useState(() => monthKeyOf(todayIso(DEFAULT_TIMEZONE)));

  return (
    <>
      <PageTitle>{es.reports.title}</PageTitle>
      <Tabs
        options={REPORTS}
        value={report}
        label={(option) => es.reports.tabs[option]}
        onChange={setReport}
      />
      {report === 'categories' ? (
        <CategoryReport month={month} onMonth={setMonth} />
      ) : (
        <ConsumptionReport month={month} onMonth={setMonth} />
      )}
    </>
  );
}
