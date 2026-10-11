import { es } from '../../shared/i18n/es';
import { Notice, PageTitle } from '../../shared/ui/ui';

/** Stage 4 (docs/ROADMAP.md). The tab exists so the navigation is already final. */
export function ReportsPage() {
  return (
    <>
      <PageTitle>{es.reports.title}</PageTitle>
      <Notice>{es.reports.pending}</Notice>
    </>
  );
}
