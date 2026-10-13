import { DEFAULT_TIMEZONE, addMonthsToKey, formatMonth, monthKeyOf, todayIso } from '@gastos/shared';
import { es } from '../../shared/i18n/es';

const STEP = 'min-h-11 min-w-11 rounded-lg border border-line bg-surface text-xl disabled:opacity-40';

/** Moves a report one month back or forward. There is nothing to report on months to come. */
export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const currentMonth = monthKeyOf(todayIso(DEFAULT_TIMEZONE));
  return (
    <nav className="mb-4 flex items-center justify-between gap-2">
      <button
        type="button"
        className={STEP}
        aria-label={es.reports.previousMonth}
        onClick={() => onChange(addMonthsToKey(month, -1))}
      >
        ‹
      </button>
      <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
      <button
        type="button"
        className={STEP}
        aria-label={es.reports.nextMonth}
        disabled={month >= currentMonth}
        onClick={() => onChange(addMonthsToKey(month, 1))}
      >
        ›
      </button>
    </nav>
  );
}
