import {
  centsToDecimalString,
  formatMoney,
  parseAmountToCents,
  type Account,
  type CardPeriodCreate,
  type ExtractedStatement,
} from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Card, Field, Notice, TextInput } from '../../shared/ui/ui';

/** A statement's dates as the user is reviewing them, all text until confirmed. */
export interface PeriodDraft {
  save: boolean;
  closingDate: string;
  dueDate: string;
  total: string;
  minimum: string;
  accountIds: string[];
}

export type PeriodErrors = Partial<Record<keyof PeriodDraft, string>>;

const amountText = (cents: number | null) => (cents === null ? '' : centsToDecimalString(cents));

/**
 * The same plastic card in pesos and in dollars is two accounts of the same
 * bank and brand. Those are the cards a statement's dates apply to.
 */
export function sameCard(account: Account | undefined, accounts: readonly Account[]): Account[] {
  if (!account || account.type !== 'credit_card') return [];
  const twins = accounts.filter(
    (candidate) =>
      candidate.id !== account.id &&
      !candidate.archived &&
      candidate.type === 'credit_card' &&
      candidate.currency !== account.currency &&
      account.bankId !== null &&
      candidate.bankId === account.bankId &&
      candidate.networkId === account.networkId,
  );
  return [account, ...twins];
}

/** This statement's dates and, when printed, the next ones: offered, not imposed. */
export function toPeriodDrafts(statement: ExtractedStatement | null, cardIds: string[]): PeriodDraft[] {
  if (!statement) return [];
  const draft = (
    closingDate: string | null,
    dueDate: string | null,
    total: number | null,
    minimum: number | null,
  ): PeriodDraft => ({
    save: Boolean(closingDate && dueDate),
    closingDate: closingDate ?? '',
    dueDate: dueDate ?? '',
    total: amountText(total),
    minimum: amountText(minimum),
    accountIds: cardIds,
  });
  const drafts = [
    draft(statement.closingDate, statement.dueDate, statement.totalCents, statement.minimumPaymentCents),
  ];
  if (statement.nextClosingDate || statement.nextDueDate)
    drafts.push(draft(statement.nextClosingDate, statement.nextDueDate, null, null));
  return drafts;
}

/**
 * The periods the user chose to keep, ready for the confirmation, plus the
 * problems found on the way. `positions` maps each period back to its draft.
 */
export function fromPeriodDrafts(drafts: readonly PeriodDraft[]) {
  const errors: Record<number, PeriodErrors> = {};
  const flag = (index: number, field: keyof PeriodDraft, message: string) => {
    errors[index] = { ...errors[index], [field]: message };
  };
  const optionalCents = (index: number, field: 'total' | 'minimum') => {
    const text = drafts[index]![field].trim();
    if (text === '') return null;
    const cents = parseAmountToCents(text);
    if (cents === null || cents < 0) flag(index, field, fieldMessage('amount'));
    return cents;
  };
  const positions = drafts.flatMap((draft, index) => (draft.save ? [index] : []));
  const periods: CardPeriodCreate[] = positions.map((index) => {
    const draft = drafts[index]!;
    if (draft.accountIds.length === 0) flag(index, 'accountIds', es.documents.periodCardsMissing);
    return {
      accountIds: draft.accountIds,
      closingDate: draft.closingDate,
      dueDate: draft.dueDate,
      totalCents: optionalCents(index, 'total'),
      minimumPaymentCents: optionalCents(index, 'minimum'),
    };
  });
  return { periods, positions, errors };
}

/**
 * The dates read from a card statement, to keep with the purchases, and a
 * check of what is ticked against the statement's total.
 */
export function StatementSection({
  drafts,
  errors,
  cards,
  ticked,
  onChange,
}: {
  drafts: readonly PeriodDraft[];
  errors: Record<number, PeriodErrors>;
  cards: readonly Account[];
  /** What the ticked transactions add up to in the statement's currency. */
  ticked: { cents: number; currency: string };
  onChange: (index: number, changes: Partial<PeriodDraft>) => void;
}) {
  const totalCents = drafts[0] ? parseAmountToCents(drafts[0].total) : null;
  const gap = totalCents === null ? 0 : totalCents - ticked.cents;

  return (
    <Card>
      <h2 className="text-lg font-semibold">{es.documents.periodsTitle}</h2>
      <p className="mb-3 mt-1 text-sm text-muted">{es.documents.periodsText}</p>

      {totalCents !== null ? (
        <div className="mb-3 space-y-2">
          <Notice tone={gap === 0 ? 'info' : 'attention'}>
            {es.documents.statementSum(
              formatMoney(ticked.cents, ticked.currency),
              formatMoney(totalCents, ticked.currency),
            )}{' '}
            {gap === 0 ? es.cards.matches : es.documents.statementGap(formatMoney(gap, ticked.currency))}
          </Notice>
        </div>
      ) : null}

      <div className="space-y-4">
        {drafts.map((draft, index) => {
          const problems = errors[index] ?? {};
          return (
            <fieldset key={index} className="space-y-3">
              <legend className="font-semibold">
                {index === 0 ? es.documents.thisPeriod : es.documents.nextPeriod}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={draft.save}
                  onChange={(event) => onChange(index, { save: event.target.checked })}
                />
                {es.documents.savePeriod}
              </label>

              {draft.save ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={es.cards.closing} error={problems.closingDate}>
                      <TextInput
                        type="date"
                        value={draft.closingDate}
                        onChange={(event) => onChange(index, { closingDate: event.target.value })}
                      />
                    </Field>
                    <Field label={es.cards.due} error={problems.dueDate}>
                      <TextInput
                        type="date"
                        value={draft.dueDate}
                        onChange={(event) => onChange(index, { dueDate: event.target.value })}
                      />
                    </Field>
                  </div>
                  {index === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={`${es.cards.total} (${es.common.optional})`} error={problems.total}>
                        <TextInput
                          inputMode="decimal"
                          className="amount"
                          value={draft.total}
                          onChange={(event) => onChange(index, { total: event.target.value })}
                        />
                      </Field>
                      <Field label={`${es.cards.minimum} (${es.common.optional})`} error={problems.minimum}>
                        <TextInput
                          inputMode="decimal"
                          className="amount"
                          value={draft.minimum}
                          onChange={(event) => onChange(index, { minimum: event.target.value })}
                        />
                      </Field>
                    </div>
                  ) : null}
                  <fieldset>
                    <legend className="mb-1 text-sm font-medium text-muted">
                      {es.documents.periodCards}
                    </legend>
                    {cards.map((card) => (
                      <label key={card.id} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={draft.accountIds.includes(card.id)}
                          onChange={(event) =>
                            onChange(index, {
                              accountIds: event.target.checked
                                ? [...draft.accountIds, card.id]
                                : draft.accountIds.filter((id) => id !== card.id),
                            })
                          }
                        />
                        {card.name} ({card.currency})
                      </label>
                    ))}
                    {problems.accountIds ? (
                      <p role="alert" className="text-sm text-expense">
                        {problems.accountIds}
                      </p>
                    ) : null}
                  </fieldset>
                </>
              ) : null}
            </fieldset>
          );
        })}
      </div>
    </Card>
  );
}
