import type { ReactNode } from 'react';
import { formatMoney } from '@gastos/shared';

const PERCENT = 100;
const BAR_TONE = { income: 'bg-income', expense: 'bg-expense' } as const;

/**
 * One line of a report: a name, its amount and its share of the total as a
 * bar. With `children` it opens to show what it is made of.
 */
export function ShareRow({
  label,
  cents,
  totalCents,
  currency,
  tone,
  children,
}: {
  label: string;
  cents: number;
  totalCents: number;
  currency: string;
  tone: keyof typeof BAR_TONE;
  children?: ReactNode;
}) {
  // A refund larger than what was spent makes a line negative: its bar is simply empty.
  const share = totalCents <= 0 ? 0 : Math.max(0, Math.round((cents / totalCents) * PERCENT));
  const line = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 break-words font-medium">
          {children ? (
            <span aria-hidden="true" className="mr-2 inline-block text-muted group-open:rotate-90">
              ›
            </span>
          ) : null}
          {label}
        </span>
        <span className="amount shrink-0 font-semibold">{formatMoney(cents, currency)}</span>
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <span className={`block h-full ${BAR_TONE[tone]}`} style={{ width: `${share}%` }} />
        </span>
        <span className="w-10 shrink-0 text-right text-sm text-muted">{share}%</span>
      </span>
    </>
  );

  if (!children) return <div className="border-t border-line px-1 py-3 first:border-t-0">{line}</div>;
  return (
    <details className="group border-t border-line first:border-t-0">
      <summary className="block cursor-pointer list-none px-1 py-3 [&::-webkit-details-marker]:hidden">
        {line}
      </summary>
      {children}
    </details>
  );
}
