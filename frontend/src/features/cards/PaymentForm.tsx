import { useState, type FormEvent } from 'react';
import {
  DEFAULT_TIMEZONE,
  cardPaymentSchema,
  centsToDecimalString,
  parseAmountToCents,
  todayIso,
  type Account,
  type CardPayment,
} from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Button, Field, Notice, Select, TextInput } from '../../shared/ui/ui';

/**
 * Registers a payment of a card statement. The amounts start at what is left
 * to pay; when the money comes from an account in another currency, both are
 * asked: what leaves the account and what it covers of the statement.
 */
export function PaymentForm({
  card,
  sources,
  remainingCents,
  busy,
  onPay,
  onCancel,
}: {
  card: Account;
  /** The accounts the money can come from. */
  sources: readonly Account[];
  /** What is left to pay of the statement, in the card's currency. */
  remainingCents: number;
  busy: boolean;
  onPay: (payment: CardPayment) => Promise<boolean>;
  onCancel: () => void;
}) {
  const suggested = remainingCents > 0 ? centsToDecimalString(remainingCents) : '';
  /** What is left to pay is in the card's currency: it only suggests what leaves an account in the same one. */
  const suggestedFrom = (account: Account | undefined) =>
    account?.currency === card.currency ? suggested : '';
  const [accountId, setAccountId] = useState(sources[0]?.id ?? '');
  const [date, setDate] = useState(() => todayIso(DEFAULT_TIMEZONE));
  const [amount, setAmount] = useState(() => suggestedFrom(sources[0]));
  const [reaches, setReaches] = useState(suggested);
  const [problem, setProblem] = useState<string | null>(null);

  const source = sources.find((candidate) => candidate.id === accountId);
  const otherCurrency = source !== undefined && source.currency !== card.currency;
  const chooseSource = (id: string) => {
    setAccountId(id);
    setAmount(suggestedFrom(sources.find((candidate) => candidate.id === id)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = cardPaymentSchema.safeParse({
      accountId,
      date,
      amountCents: parseAmountToCents(amount),
      toAmountCents: otherCurrency ? parseAmountToCents(reaches) : null,
    });
    // The only things typed here are the amounts, so that is what there is to fix.
    if (!parsed.success || (otherCurrency && parsed.data.toAmountCents === null)) {
      setProblem(fieldMessage('amount'));
      return;
    }
    setProblem(null);
    await onPay(parsed.data);
  };

  if (sources.length === 0) {
    return (
      <div className="mt-2 space-y-2">
        <Notice>{es.cards.noOtherAccounts}</Notice>
        <Button variant="secondary" onClick={onCancel}>
          {es.common.close}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-2 space-y-3" noValidate>
      <p className="text-sm text-muted">{es.cards.payText}</p>
      <Field label={es.cards.payFrom}>
        <Select value={accountId} onChange={(event) => chooseSource(event.target.value)}>
          {sources.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ({option.currency})
            </option>
          ))}
        </Select>
      </Field>
      <Field label={es.cards.payDate}>
        <TextInput
          type="date"
          max={todayIso(DEFAULT_TIMEZONE)}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>
      <Field label={es.cards.payAmount(source?.currency ?? card.currency)}>
        <TextInput
          inputMode="decimal"
          className="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      {otherCurrency ? (
        <Field label={es.cards.payReaches(card.currency)}>
          <TextInput
            inputMode="decimal"
            className="amount"
            value={reaches}
            onChange={(event) => setReaches(event.target.value)}
          />
        </Field>
      ) : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? es.common.saving : es.cards.paySubmit}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {es.common.cancel}
        </Button>
      </div>
    </form>
  );
}
