import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { es } from '../i18n/es';

/** The small set of building blocks every screen is made of. */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet' | 'quietDanger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-primary-soft text-primary-ink',
  danger: 'bg-expense-soft text-expense',
  quiet: 'text-primary',
  /** A quiet button that deletes or switches off: red, like the danger one. */
  quietDanger: 'text-expense',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 rounded-xl px-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1 block text-sm text-expense">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const CONTROL =
  'block w-full min-h-12 rounded-xl border border-edge bg-surface px-3 text-base text-ink placeholder:text-muted';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

/** Long text the user reads and edits, such as a statement before it is sent. */
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} py-2 font-mono text-sm ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface p-4 shadow-card ${className}`}>{children}</section>;
}

type NoticeTone = 'info' | 'error' | 'success' | 'attention';

const NOTICE_STYLES: Record<NoticeTone, string> = {
  info: 'bg-surface text-muted shadow-card',
  error: 'bg-expense-soft text-expense',
  success: 'bg-income-soft text-income',
  attention: 'bg-attention-soft text-ink',
};

export function Notice({ tone = 'info', children }: { tone?: NoticeTone; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl px-4 py-3 text-sm ${NOTICE_STYLES[tone]}`}
    >
      {children}
    </p>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-muted">{es.common.loading}</p>;
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {action}
    </header>
  );
}

/**
 * A row of mutually exclusive choices that switches what the screen shows
 * below it. Many choices wrap in rows of `columns`, so they fit on a phone.
 */
export function Tabs<T extends string>({
  options,
  value,
  label,
  onChange,
  columns = options.length,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
  columns?: number;
}) {
  return (
    <div
      role="tablist"
      className="mb-4 grid gap-1 rounded-2xl bg-surface p-1 shadow-card"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option}
          role="tab"
          type="button"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={`min-h-10 rounded-xl text-sm font-semibold transition ${value === option ? 'bg-primary text-on-primary' : 'text-muted'}`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}
