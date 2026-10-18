import { Link } from 'react-router-dom';
import { CURRENCIES, type Consolidation } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { Notice } from '../../shared/ui/ui';
import type { ShowIn } from './api';

/** Each currency apart, or everything in pesos or in dollars: three small choices, not a big list. */
export function ShowInSelect({ value, onChange }: { value: ShowIn; onChange: (value: ShowIn) => void }) {
  const options: { value: ShowIn; label: string }[] = [
    { value: undefined, label: es.reports.eachCurrency },
    ...CURRENCIES.map((currency) => ({ value: currency, label: es.reports.allIn[currency] })),
  ];
  return (
    <div role="radiogroup" aria-label={es.reports.showIn} className="mb-4 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-full px-3 text-sm font-semibold transition ${
            value === option.value ? 'bg-primary text-on-primary' : 'bg-surface text-muted shadow-card'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** What showing everything in one currency left out, and how to fix it. */
export function ConsolidationNotice({ consolidated }: { consolidated: Consolidation | null }) {
  if (!consolidated) return null;
  if (consolidated.leftOut === 0) return <p className="text-sm text-muted">{es.reports.convertedWith}</p>;
  return (
    <Notice tone="attention">
      {es.reports.leftOut(consolidated.leftOut)}{' '}
      <Link to="/mas/tasas" className="font-semibold underline">
        {es.reports.loadRate}
      </Link>
    </Notice>
  );
}
