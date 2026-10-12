import { useState, type FormEvent } from 'react';
import {
  cardPeriodUpdateSchema,
  centsToDecimalString,
  formatDate,
  formatMoney,
  parseAmountToCents,
  type Account,
  type CardPeriodCreate,
  type CardPeriodView,
} from '@gastos/shared';
import { errorMessage, fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { useAction } from '../../shared/ui/useAction';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Loading, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCardPeriodMutations, useCardStatement } from './api';

interface PeriodDraft {
  closingDate: string;
  dueDate: string;
  total: string;
  minimum: string;
}

const EMPTY: PeriodDraft = { closingDate: '', dueDate: '', total: '', minimum: '' };

/** Either the period to save or the reason it cannot be saved. */
type DraftResult = { ok: true; data: Omit<CardPeriodCreate, 'accountIds'> } | { ok: false; error: string };

/**
 * Reads the typed dates and amounts. The rules (due after closing, positive
 * amounts) are the shared schema's, so the screen and the server agree.
 */
function readDraft(draft: PeriodDraft): DraftResult {
  const total = draft.total.trim() ? parseAmountToCents(draft.total) : null;
  const minimum = draft.minimum.trim() ? parseAmountToCents(draft.minimum) : null;
  if ((draft.total.trim() && total === null) || (draft.minimum.trim() && minimum === null)) {
    return { ok: false, error: fieldMessage('amount') };
  }
  if (!draft.closingDate || !draft.dueDate) return { ok: false, error: es.cards.datesRequired };
  const data = {
    closingDate: draft.closingDate,
    dueDate: draft.dueDate,
    totalCents: total,
    minimumPaymentCents: minimum,
  };
  const parsed = cardPeriodUpdateSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: fieldMessage(parsed.error.issues[0]?.message ?? 'invalid') };
  return { ok: true, data };
}

function PeriodFields({ draft, onChange }: { draft: PeriodDraft; onChange: (draft: PeriodDraft) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={es.cards.closing}>
          <TextInput
            type="date"
            value={draft.closingDate}
            onChange={(event) => onChange({ ...draft, closingDate: event.target.value })}
          />
        </Field>
        <Field label={es.cards.due}>
          <TextInput
            type="date"
            value={draft.dueDate}
            onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${es.cards.total} (${es.common.optional})`}>
          <TextInput
            inputMode="decimal"
            className="amount"
            value={draft.total}
            onChange={(event) => onChange({ ...draft, total: event.target.value })}
          />
        </Field>
        <Field label={`${es.cards.minimum} (${es.common.optional})`}>
          <TextInput
            inputMode="decimal"
            className="amount"
            value={draft.minimum}
            onChange={(event) => onChange({ ...draft, minimum: event.target.value })}
          />
        </Field>
      </div>
    </>
  );
}

function PeriodRow({
  period,
  currency,
  busy,
  onSave,
  onDelete,
}: {
  period: CardPeriodView;
  currency: string;
  busy: boolean;
  onSave: (draft: PeriodDraft) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<PeriodDraft | null>(null);
  const difference = period.totalCents === null ? null : period.totalCents - period.chargedCents;

  if (draft) {
    const save = async (event: FormEvent) => {
      event.preventDefault();
      if (await onSave(draft)) setDraft(null);
    };
    return (
      <li className="p-3">
        <form onSubmit={(event) => void save(event)} className="space-y-3" noValidate>
          <PeriodFields draft={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={busy}>
              {es.common.save}
            </Button>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              {es.common.cancel}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{es.cards.dueOn(formatDate(period.dueDate))}</p>
        <p className="amount shrink-0 font-semibold">{formatMoney(period.chargedCents, currency)}</p>
      </div>
      <p className="text-sm text-muted">
        {es.cards.closedOn(formatDate(period.closingDate))} · {es.cards.purchases(period.transactionCount)}
      </p>
      {period.totalCents !== null ? (
        <p className={`text-sm ${difference === 0 ? 'text-muted' : 'text-expense'}`}>
          {es.cards.statementTotal(formatMoney(period.totalCents, currency))}
          {difference !== 0 && difference !== null
            ? ` ${es.cards.difference(formatMoney(difference, currency))}`
            : ` ${es.cards.matches}`}
        </p>
      ) : null}
      {period.minimumPaymentCents !== null ? (
        <p className="text-sm text-muted">
          {es.cards.minimumIs(formatMoney(period.minimumPaymentCents, currency))}
        </p>
      ) : null}
      <div className="mt-1 flex">
        <Button
          variant="quiet"
          className="px-0 pr-4"
          onClick={() =>
            setDraft({
              closingDate: period.closingDate,
              dueDate: period.dueDate,
              total: period.totalCents === null ? '' : centsToDecimalString(period.totalCents),
              minimum:
                period.minimumPaymentCents === null ? '' : centsToDecimalString(period.minimumPaymentCents),
            })
          }
        >
          {es.common.edit}
        </Button>
        <Button variant="quiet" className="px-0 text-expense" disabled={busy} onClick={onDelete}>
          {es.common.delete}
        </Button>
      </div>
    </li>
  );
}

function CardStatementView({ card, cards }: { card: Account; cards: readonly Account[] }) {
  const statement = useCardStatement(card.id);
  const { create, update, remove } = useCardPeriodMutations();
  const [draft, setDraft] = useState<PeriodDraft>(EMPTY);
  // The same card in the other currency shares its dates: offered ticked.
  const twins = cards.filter(
    (other) =>
      other.id !== card.id &&
      other.bankId !== null &&
      other.bankId === card.bankId &&
      other.networkId === card.networkId,
  );
  const [alsoFor, setAlsoFor] = useState<string[]>(() => twins.map((twin) => twin.id));
  const { failure, setFailure, run } = useAction();
  const busy = create.isPending || update.isPending || remove.isPending;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const read = readDraft(draft);
    if (!read.ok) {
      setFailure(read.error);
      return;
    }
    const done = await run(() => create.mutateAsync({ ...read.data, accountIds: [card.id, ...alsoFor] }));
    if (done) setDraft(EMPTY);
  };

  const save = (id: string, edited: PeriodDraft) => {
    const read = readDraft(edited);
    if (!read.ok) {
      setFailure(read.error);
      return Promise.resolve(false);
    }
    return run(() => update.mutateAsync({ id, changes: read.data }));
  };

  return (
    <div className="space-y-4">
      {failure ? <Notice tone="error">{failure}</Notice> : null}

      <QueryState query={statement}>
        {(data) => (
          <>
            <Card>
              <p className="text-sm text-muted">
                {data.open.since ? es.cards.openSince(formatDate(data.open.since)) : es.cards.openNoClosing}
              </p>
              <p className="amount text-3xl font-bold tracking-tight">
                {formatMoney(data.open.chargedCents, card.currency)}
              </p>
              <p className="text-sm text-muted">{es.cards.purchases(data.open.transactionCount)}</p>
              {data.periods.length === 0 ? <p className="mt-2 text-sm">{es.cards.firstHint}</p> : null}
            </Card>

            {data.periods.length > 0 ? (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {data.periods.map((period) => (
                  <PeriodRow
                    key={period.id}
                    period={period}
                    currency={card.currency}
                    busy={busy}
                    onSave={(edited) => save(period.id, edited)}
                    onDelete={() => {
                      if (window.confirm(es.cards.deleteConfirm))
                        void run(() => remove.mutateAsync(period.id));
                    }}
                  />
                ))}
              </ul>
            ) : null}
          </>
        )}
      </QueryState>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">{es.cards.newTitle}</h2>
        <p className="mb-3 text-sm text-muted">{es.cards.newText}</p>
        <form onSubmit={(event) => void add(event)} className="space-y-3" noValidate>
          <PeriodFields draft={draft} onChange={setDraft} />
          {cards.length > 1 ? (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium text-muted">{es.cards.alsoFor}</legend>
              {cards
                .filter((other) => other.id !== card.id)
                .map((other) => (
                  <label key={other.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={alsoFor.includes(other.id)}
                      onChange={(event) =>
                        setAlsoFor(
                          event.target.checked
                            ? [...alsoFor, other.id]
                            : alsoFor.filter((id) => id !== other.id),
                        )
                      }
                    />
                    {other.name} ({other.currency})
                  </label>
                ))}
            </fieldset>
          ) : null}
          <Button type="submit" disabled={busy}>
            {create.isPending ? es.common.saving : es.common.add}
          </Button>
        </form>
      </Card>
    </div>
  );
}

/** Credit cards: their statements, and what is paid on each due date. */
export function CardsPage() {
  const accounts = useAccounts();
  const [selected, setSelected] = useState('');

  if (accounts.isPending) return <Loading />;
  if (accounts.error) return <Notice tone="error">{errorMessage(accounts.error)}</Notice>;

  const cards = accounts.data.filter((account) => account.type === 'credit_card' && !account.archived);
  const card = cards.find((candidate) => candidate.id === selected) ?? cards[0];

  return (
    <>
      <PageTitle>{es.cards.title}</PageTitle>
      {!card ? (
        <Notice>{es.cards.noCards}</Notice>
      ) : (
        <>
          {cards.length > 1 ? (
            <div className="mb-4">
              <Select
                aria-label={es.cards.title}
                value={card.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {cards.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.currency})
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <CardStatementView key={card.id} card={card} cards={cards} />
        </>
      )}
    </>
  );
}
