import { useState, type FormEvent } from 'react';
import {
  DEFAULT_TIMEZONE,
  exchangeRateInputSchema,
  formatDate,
  formatRate,
  parseRate,
  todayIso,
  type ExchangeRate,
  type ExchangeRateInput,
} from '@gastos/shared';
import { ApiError } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, TextInput } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useExchangeRateMutations, useExchangeRates } from './api';

/** Two rates starting the same day is the one failure worth its own sentence here. */
const describe = (error: unknown) =>
  error instanceof ApiError && error.code === 'DUPLICATE' ? es.rates.duplicate : errorMessage(error);

/** The day and the rate, as typed. Resolves true when saved. */
function RateForm({
  initial,
  busy,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: { validFrom: string; rate: string };
  busy: boolean;
  submitLabel: string;
  onSave: (input: { validFrom: string; rate: string }) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [validFrom, setValidFrom] = useState(initial.validFrom);
  const [rate, setRate] = useState(initial.rate);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!(await onSave({ validFrom, rate }))) return;
    // Editing closes the form; adding leaves it ready for the next one.
    if (onCancel) onCancel();
    else setRate('');
  };
  return (
    <form onSubmit={(event) => void save(event)} className="space-y-3" noValidate>
      <Field label={es.rates.validFrom}>
        <TextInput type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
      </Field>
      <Field label={es.rates.arsPerUsd} hint={es.rates.arsPerUsdHint}>
        <TextInput inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !validFrom || !rate.trim()}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            {es.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function RateRow({
  rate,
  busy,
  onSave,
  onDelete,
}: {
  rate: ExchangeRate;
  busy: boolean;
  onSave: (input: { validFrom: string; rate: string }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="p-3">
        <RateForm
          initial={{ validFrom: rate.validFrom, rate: formatRate(rate.arsPerUsd) }}
          busy={busy}
          submitLabel={es.common.save}
          onSave={onSave}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3 py-2 pl-3 pr-2">
      <span className="min-w-0">
        <span className="block font-medium">{es.rates.row(formatRate(rate.arsPerUsd))}</span>
        <span className="block text-sm text-muted">
          {es.rates.validFrom} {formatDate(rate.validFrom)}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        <Button variant="quiet" onClick={() => setEditing(true)}>
          {es.common.edit}
        </Button>
        <Button variant="quiet" className="text-expense" disabled={busy} onClick={onDelete}>
          {es.common.delete}
        </Button>
      </span>
    </li>
  );
}

/** The user's pesos-per-dollar rates, which the reports use to show everything in one currency. */
export function RatesPage() {
  const rates = useExchangeRates();
  const { create, update, remove } = useExchangeRateMutations();
  const { failure, setFailure, run } = useAction(describe);
  const busy = create.isPending || update.isPending || remove.isPending;

  /** The typed form as the shared rules check it, or null after saying what is wrong. */
  const checked = (input: { validFrom: string; rate: string }): ExchangeRateInput | null => {
    const parsed = exchangeRateInputSchema.safeParse({
      validFrom: input.validFrom,
      arsPerUsd: parseRate(input.rate),
    });
    if (parsed.success) return parsed.data;
    setFailure(es.rates.invalid);
    return null;
  };

  const add = (input: { validFrom: string; rate: string }) => {
    const valid = checked(input);
    return valid ? run(() => create.mutateAsync(valid)) : Promise.resolve(false);
  };

  return (
    <>
      <PageTitle>{es.rates.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.rates.text}</p>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={rates}>
        {(items) =>
          items.length === 0 ? (
            <div className="mb-6">
              <Notice>{es.rates.empty}</Notice>
            </div>
          ) : (
            <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
              {/* The newest first: it is the one in use today. */}
              {[...items].reverse().map((rate) => (
                <RateRow
                  key={rate.id}
                  rate={rate}
                  busy={busy}
                  onSave={(input) => {
                    const valid = checked(input);
                    return valid
                      ? run(() => update.mutateAsync({ id: rate.id, input: valid }))
                      : Promise.resolve(false);
                  }}
                  onDelete={() => {
                    if (window.confirm(es.rates.deleteConfirm)) void run(() => remove.mutateAsync(rate.id));
                  }}
                />
              ))}
            </ul>
          )
        }
      </QueryState>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{es.rates.newTitle}</h2>
        <RateForm
          initial={{ validFrom: todayIso(DEFAULT_TIMEZONE), rate: '' }}
          busy={busy}
          submitLabel={create.isPending ? es.common.saving : es.common.add}
          onSave={add}
        />
      </Card>
    </>
  );
}
