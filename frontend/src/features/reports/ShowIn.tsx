import { Link } from 'react-router-dom';
import { CURRENCIES, type Consolidation, type Currency } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { Field, Notice, Select } from '../../shared/ui/ui';
import type { ShowIn } from './api';

/** Each currency apart, or everything in pesos or in dollars. */
export function ShowInSelect({ value, onChange }: { value: ShowIn; onChange: (value: ShowIn) => void }) {
  return (
    <div className="mb-4">
      <Field label={es.reports.showIn}>
        <Select
          value={value ?? ''}
          onChange={(event) => onChange((event.target.value || undefined) as Currency | undefined)}
        >
          <option value="">{es.reports.eachCurrency}</option>
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {es.reports.allIn[currency]}
            </option>
          ))}
        </Select>
      </Field>
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
