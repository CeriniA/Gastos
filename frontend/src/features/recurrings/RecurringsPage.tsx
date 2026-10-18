import { useState, type FormEvent } from 'react';
import {
  MAX_DAY_OF_MONTH,
  TEXT_LIMITS,
  centsToDecimalString,
  formatDate,
  formatMoney,
  parseAmountToCents,
  recurringUpdateSchema,
  type Recurring,
  type RecurringMonth,
  type RecurringState,
  type RecurringSuggestion,
  type RecurringUpdate,
} from '@gastos/shared';
import { firstProblem } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { useRecurringMutations, useRecurrings } from './api';

/** How each state reads at a glance: what needs a look stands out. */
const STATE_TONE: Record<RecurringState, string> = {
  seen: 'text-income',
  changed: 'text-attention',
  late: 'text-expense',
  expected: 'text-muted',
  paused: 'text-muted',
};

/** The fields of a fixed item the user can change, as typed. */
function EditForm({
  recurring,
  busy,
  onSave,
  onCancel,
}: {
  recurring: Recurring;
  busy: boolean;
  onSave: (changes: RecurringUpdate) => Promise<boolean>;
  onCancel: () => void;
}) {
  const accounts = useAccounts();
  const categories = useCategories();
  const { failure, setFailure } = useAction();
  const [name, setName] = useState(recurring.name);
  const [amount, setAmount] = useState(centsToDecimalString(recurring.expectedAmountCents));
  const [day, setDay] = useState(String(recurring.dayOfMonth));
  const [accountId, setAccountId] = useState(recurring.accountId);
  const [categoryId, setCategoryId] = useState(recurring.categoryId ?? '');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = recurringUpdateSchema.safeParse({
      name,
      expectedAmountCents: parseAmountToCents(amount),
      dayOfMonth: Number(day),
      accountId,
      categoryId: categoryId || null,
    });
    if (!parsed.success) {
      setFailure(firstProblem(parsed.error.issues));
      return;
    }
    if (await onSave(parsed.data)) onCancel();
  };

  const accountOptions = (accounts.data ?? []).filter(
    (account) => !account.archived || account.id === recurring.accountId,
  );
  const categoryOptions = orderedTree(categories.data ?? [], recurring.type).filter(
    (category) => !category.archived || category.id === recurring.categoryId,
  );

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-3" noValidate>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <Field label={es.recurrings.name}>
        <TextInput
          value={name}
          maxLength={TEXT_LIMITS.name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label={es.recurrings.expectedAmount}>
        <TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label={es.recurrings.day} hint={es.recurrings.dayHint}>
        <TextInput
          inputMode="numeric"
          value={day}
          maxLength={String(MAX_DAY_OF_MONTH).length}
          onChange={(event) => setDay(event.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Field label={es.transactions.fields.account}>
        <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={es.transactions.fields.category}>
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">{es.transactions.noCategory}</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {optionLabel(category)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          {es.common.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {es.common.cancel}
        </Button>
      </div>
    </form>
  );
}

function ItemRow({
  item,
  busy,
  onUpdate,
  onDelete,
}: {
  item: RecurringMonth;
  busy: boolean;
  onUpdate: (changes: RecurringUpdate) => Promise<boolean>;
  onDelete: () => void;
}) {
  const { recurring, state } = item;
  const [editing, setEditing] = useState(false);
  const expected = formatMoney(recurring.expectedAmountCents, recurring.currency);

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block break-words font-medium">{recurring.name}</span>
          <span className={`block text-sm font-semibold ${STATE_TONE[state]}`}>
            {es.recurrings.states[state]}
          </span>
          <span className="block text-sm text-muted">
            {es.recurrings.expectedOn(formatDate(item.expectedDate), expected)}
          </span>
          {item.transactionIds.length > 0 ? (
            <span className="block text-sm text-muted">
              {es.recurrings.seenAmount(formatMoney(item.seenCents, recurring.currency))}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Button variant="quiet" disabled={busy} onClick={() => setEditing(!editing)}>
            {es.common.edit}
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => void onUpdate({ active: !recurring.active })}
          >
            {recurring.active ? es.recurrings.pause : es.recurrings.resume}
          </Button>
          <Button variant="quietDanger" disabled={busy} onClick={onDelete}>
            {es.common.delete}
          </Button>
        </span>
      </div>
      {state === 'changed' ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void onUpdate({ expectedAmountCents: item.seenCents })}
        >
          {es.recurrings.useSeen}
        </Button>
      ) : null}
      {editing ? (
        <EditForm recurring={recurring} busy={busy} onSave={onUpdate} onCancel={() => setEditing(false)} />
      ) : null}
    </li>
  );
}

function SuggestionRow({
  suggestion,
  busy,
  onAnswer,
}: {
  suggestion: RecurringSuggestion;
  busy: boolean;
  onAnswer: (ignore: boolean) => void;
}) {
  return (
    <li className="space-y-2 p-3">
      <span className="block break-words font-medium">{suggestion.name}</span>
      <span className="block text-sm text-muted">
        {es.recurrings.suggestion(
          formatMoney(suggestion.amountCents, suggestion.currency),
          suggestion.months,
        )}
      </span>
      <span className="flex gap-2">
        <Button disabled={busy} onClick={() => onAnswer(false)}>
          {es.recurrings.accept}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onAnswer(true)}>
          {es.recurrings.reject}
        </Button>
      </span>
    </li>
  );
}

/**
 * Fixed income and expenses: how each stands this month, what looks fixed
 * (the user decides), and the merchants the user said are not.
 */
export function RecurringsPage() {
  const overview = useRecurrings();
  const { fromTransaction, update, remove } = useRecurringMutations();
  const { failure, run } = useAction();
  const busy = fromTransaction.isPending || update.isPending || remove.isPending;

  return (
    <>
      <PageTitle>{es.recurrings.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.recurrings.text}</p>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={overview}>
        {(data) => (
          <div className="space-y-6">
            {data.items.length === 0 ? (
              <Notice>{es.recurrings.empty}</Notice>
            ) : (
              <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
                {data.items.map((item) => (
                  <ItemRow
                    key={item.recurring.id}
                    item={item}
                    busy={busy}
                    onUpdate={(changes) => run(() => update.mutateAsync({ id: item.recurring.id, changes }))}
                    onDelete={() => {
                      if (window.confirm(es.recurrings.deleteConfirm(item.recurring.name)))
                        void run(() => remove.mutateAsync(item.recurring.id));
                    }}
                  />
                ))}
              </ul>
            )}

            {data.suggestions.length === 0 ? null : (
              <Card>
                <h2 className="text-lg font-semibold">{es.recurrings.suggestionsTitle}</h2>
                <p className="mb-2 mt-1 text-sm text-muted">{es.recurrings.suggestionsText}</p>
                <ul className="divide-y divide-line">
                  {data.suggestions.map((suggestion) => (
                    <SuggestionRow
                      key={suggestion.transactionId}
                      suggestion={suggestion}
                      busy={busy}
                      onAnswer={(ignore) =>
                        void run(() =>
                          fromTransaction.mutateAsync({ transactionId: suggestion.transactionId, ignore }),
                        )
                      }
                    />
                  ))}
                </ul>
              </Card>
            )}

            {data.ignored.length === 0 ? null : (
              <section>
                <h2 className="text-lg font-semibold">{es.recurrings.ignoredTitle}</h2>
                <p className="mb-2 mt-1 text-sm text-muted">{es.recurrings.ignoredText}</p>
                <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
                  {data.ignored.map((recurring) => (
                    <li key={recurring.id} className="flex items-center justify-between gap-3 py-2 pl-3 pr-2">
                      <span className="min-w-0 break-words">{recurring.name}</span>
                      <Button
                        variant="quiet"
                        disabled={busy}
                        onClick={() => void run(() => remove.mutateAsync(recurring.id))}
                      >
                        {es.recurrings.unignore}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
