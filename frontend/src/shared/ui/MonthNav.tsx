import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_TIMEZONE, addMonthsToKey, formatMonth, monthKeyOf, todayIso } from '@gastos/shared';
import { es } from '../i18n/es';
import { ICON_SIZE } from './icons';

const STEP =
  'flex size-11 items-center justify-center rounded-xl text-primary disabled:text-muted disabled:opacity-40';

/**
 * Moves a screen one month back or forward: the same control in Movimientos
 * and in Informes. Reports have nothing to show for months to come; the list
 * of transactions does (installments still to be paid), so it can go on.
 */
export function MonthNav({
  month,
  onChange,
  allowFuture = false,
}: {
  month: string;
  onChange: (month: string) => void;
  allowFuture?: boolean;
}) {
  const currentMonth = monthKeyOf(todayIso(DEFAULT_TIMEZONE));
  return (
    <nav className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-surface p-1 shadow-card">
      <button
        type="button"
        className={STEP}
        aria-label={es.transactions.previousMonth}
        onClick={() => onChange(addMonthsToKey(month, -1))}
      >
        <ChevronLeft size={ICON_SIZE.nav} aria-hidden="true" />
      </button>
      <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
      <button
        type="button"
        className={STEP}
        aria-label={es.transactions.nextMonth}
        disabled={!allowFuture && month >= currentMonth}
        onClick={() => onChange(addMonthsToKey(month, 1))}
      >
        <ChevronRight size={ICON_SIZE.nav} aria-hidden="true" />
      </button>
    </nav>
  );
}
