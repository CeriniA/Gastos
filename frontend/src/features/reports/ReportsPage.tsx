import { useState } from 'react';
import { DEFAULT_TIMEZONE, monthKeyOf, todayIso } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { PageTitle, Tabs } from '../../shared/ui/ui';
import { AccountReport } from './AccountReport';
import { CategoryReport } from './CategoryReport';
import { ConsumptionReport } from './ConsumptionReport';
import { EvolutionReport } from './EvolutionReport';
import { MerchantReport } from './MerchantReport';
import { ProjectionReport } from './ProjectionReport';
import { ShowInSelect } from './ShowIn';
import type { ShowIn } from './api';

const REPORTS = ['categories', 'accounts', 'evolution', 'merchants', 'projection', 'consumption'] as const;
type Report = (typeof REPORTS)[number];
/** Six tabs do not fit in one row on a phone: two rows of three. */
const TAB_COLUMNS = 3;

/**
 * The reports, one per tab, on the same month. All but consumption can show
 * each currency apart or everything in one; consumption is about products,
 * and products are never converted.
 */
export function ReportsPage() {
  const [report, setReport] = useState<Report>('categories');
  const [month, setMonth] = useState(() => monthKeyOf(todayIso(DEFAULT_TIMEZONE)));
  const [showIn, setShowIn] = useState<ShowIn>(undefined);
  const nav = { month, onMonth: setMonth, showIn };

  return (
    <>
      <PageTitle>{es.reports.title}</PageTitle>
      <Tabs
        options={REPORTS}
        value={report}
        label={(option) => es.reports.tabs[option]}
        onChange={setReport}
        columns={TAB_COLUMNS}
      />
      {report === 'consumption' ? null : <ShowInSelect value={showIn} onChange={setShowIn} />}
      {report === 'categories' ? <CategoryReport {...nav} /> : null}
      {report === 'accounts' ? <AccountReport {...nav} /> : null}
      {report === 'evolution' ? <EvolutionReport {...nav} /> : null}
      {report === 'merchants' ? <MerchantReport {...nav} /> : null}
      {report === 'projection' ? <ProjectionReport showIn={showIn} /> : null}
      {report === 'consumption' ? <ConsumptionReport month={month} onMonth={setMonth} /> : null}
    </>
  );
}
