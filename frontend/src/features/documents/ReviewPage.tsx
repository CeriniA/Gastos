import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  TRANSACTION_TYPES,
  centsToDecimalString,
  convertCents,
  impliedRate,
  documentConfirmSchema,
  formatDate,
  formatMoney,
  formatRate,
  parseAmountToCents,
  parseRate,
  productCorrections,
  spendingCents,
  todayIso,
  type Account,
  type Category,
  type DocumentDetail,
  type DuplicateHint,
  type ReviewTransaction,
  type TransactionType,
  TEXT_LIMITS,
} from '@gastos/shared';
import { ApiError } from '../../shared/api/client';
import { errorMessage, fieldMessage } from '../../shared/api/errors';
import { useAction } from '../../shared/ui/useAction';
import { es } from '../../shared/i18n/es';
import { Button, Card, Field, Loading, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { useLastRate, useReferenceRate } from '../transactions/api';
import { ItemsEditor, fromItemDrafts, toItemDrafts, type ItemDraft } from '../transactions/ItemsEditor';
import { BalanceCheck } from './BalanceCheck';
import { DocumentImage } from './DocumentImage';
import {
  StatementSection,
  fromPeriodDrafts,
  sameCard,
  toPeriodDrafts,
  type PeriodDraft,
  type PeriodErrors,
} from './StatementSection';
import { useDocument, useDocumentMutations } from './api';

/** One extracted transaction as the user is editing it. Everything is text until confirmed. */
interface Draft {
  include: boolean;
  type: TransactionType;
  /** Expenses only: money given back for a purchase. */
  refund: boolean;
  /** An installment of a purchase the app does not have: also create the ones still to come. */
  continuePlan: boolean;
  amount: string;
  date: string;
  accountId: string;
  toAccountId: string;
  toAmount: string;
  categoryId: string;
  description: string;
  paymentDate: string;
  remember: boolean;
  /** Exchange rate typed by the user, when the receipt is in another currency. */
  rate: string;
  /** The user said the printed amount is already in the account's currency: no conversion. */
  sameCurrency: boolean;
  /** Products as read, editable; in the receipt's currency until confirmed. */
  items: ItemDraft[];
}

type DraftErrors = Partial<Record<keyof Draft, string>>;

/** Which draft field shows a problem reported for a payload field. */
const FIELD_OF: Record<string, keyof Draft> = {
  amountCents: 'amount',
  toAmountCents: 'toAmount',
  currency: 'accountId',
};

/**
 * The amount printed on the receipt when it is in a currency other than the
 * chosen account's (a purchase in reais paid from a peso account), or null.
 */
function foreignAmount(
  read: ReviewTransaction,
  account: Account | undefined,
): { amountCents: number; currency: string } | null {
  if (!account || !read.currency || read.amountCents === null || read.currency === account.currency)
    return null;
  return { amountCents: read.amountCents, currency: read.currency };
}

const readAmount = (read: ReviewTransaction) =>
  read.amountCents === null ? '' : centsToDecimalString(read.amountCents);

/** The receipt's amount at the typed rate, or empty while there is no valid rate. */
function convertedAmount(read: ReviewTransaction, rateText: string): string {
  const rate = parseRate(rateText);
  return rate && read.amountCents !== null ? centsToDecimalString(convertCents(read.amountCents, rate)) : '';
}

/**
 * Changing the account can change the currency the amount is expressed in, so
 * the amount follows: converted when the receipt is foreign to the new
 * account, back to the printed figure when it stops being so.
 */
function withAccount(
  draft: Draft,
  read: ReviewTransaction,
  accounts: readonly Account[],
  accountId: string,
): Draft {
  const find = (id: string) => accounts.find((candidate) => candidate.id === id);
  const wasForeign = !draft.sameCurrency && foreignAmount(read, find(draft.accountId)) !== null;
  const isForeign = !draft.sameCurrency && foreignAmount(read, find(accountId)) !== null;
  if (isForeign) return { ...draft, accountId, amount: convertedAmount(read, draft.rate) };
  if (wasForeign) return { ...draft, accountId, amount: readAmount(read) };
  return { ...draft, accountId };
}

/** A transfer read from an account's statement as money that arrived in it. */
const isIncoming = (transaction: ReviewTransaction) =>
  transaction.type === 'transfer' && transaction.incoming === true;

/**
 * What the ticked movements add to one account's balance: income and what
 * arrives add, expenses and what leaves take away. A refund gives back.
 */
function netFor(accountId: string, drafts: readonly Draft[]): number {
  return drafts.reduce((sum, draft) => {
    const cents = parseAmountToCents(draft.amount);
    if (!draft.include || cents === null) return sum;
    let net = sum;
    if (draft.accountId === accountId) {
      if (draft.type === 'income') net += cents;
      else if (draft.type === 'expense') net -= spendingCents({ refund: draft.refund, amountCents: cents });
      else net -= cents;
    }
    if (draft.type === 'transfer' && draft.toAccountId === accountId)
      net += parseAmountToCents(draft.toAmount) ?? cents;
    return net;
  }, 0);
}

/** An installment that is not the last one: the ones still to come could be created. */
const canContinue = (transaction: ReviewTransaction) =>
  transaction.installment !== null && transaction.installment.number < transaction.installment.total;

function toDraft(
  transaction: ReviewTransaction,
  accountId: string | null,
  accounts: readonly Account[],
): Draft {
  const draft: Draft = {
    include: true,
    type: transaction.type,
    refund: transaction.refund,
    continuePlan: canContinue(transaction),
    amount: readAmount(transaction),
    date: transaction.date ?? '',
    accountId: '',
    toAccountId: '',
    toAmount: '',
    categoryId: transaction.suggestedCategoryId ?? '',
    description: (transaction.description || transaction.merchant).slice(0, TEXT_LIMITS.description),
    paymentDate: '',
    remember: false,
    rate: '',
    sameCurrency: false,
    items: toItemDrafts(transaction.items),
  };
  // A transfer that came INTO the statement's account: that account is where it arrived.
  if (accountId && isIncoming(transaction)) return { ...draft, toAccountId: accountId };
  return accountId ? withAccount(draft, transaction, accounts, accountId) : draft;
}

function TransactionCard({
  index,
  total,
  read,
  draft,
  errors,
  accounts,
  categories,
  duplicate,
  onChange,
}: {
  index: number;
  total: number;
  read: ReviewTransaction;
  draft: Draft;
  errors: DraftErrors;
  accounts: readonly Account[];
  categories: readonly Category[];
  duplicate: DuplicateHint;
  onChange: (changes: Partial<Draft>) => void;
}) {
  const account = accounts.find((candidate) => candidate.id === draft.accountId);
  const destination = accounts.find((candidate) => candidate.id === draft.toAccountId);
  const isTransfer = draft.type === 'transfer';
  const crossCurrency =
    isTransfer && Boolean(account && destination && account.currency !== destination.currency);
  const categoryOptions =
    draft.type === 'transfer'
      ? []
      : orderedTree(categories, draft.type).filter((category) => !category.archived);
  const keptRuleCategory = read.categoryFromRule && draft.categoryId === read.suggestedCategoryId;
  const canRemember = !isTransfer && read.merchant !== '' && draft.categoryId !== '' && !keptRuleCategory;
  const doubtful = read.uncertainFields.map((field) => es.documents.uncertain[field]);
  const foreign = draft.sameCurrency ? null : foreignAmount(read, account);
  const foreignCurrency = foreign?.currency ?? null;
  const lastRate = useLastRate(foreignCurrency);
  const reference = useReferenceRate(foreignCurrency, account?.currency ?? null);
  const used = lastRate.data?.rate ? lastRate.data : null;
  // A rate the user applied on the very day of this receipt beats the public
  // one: it is what their payment app really charged. Otherwise the public
  // reference, and failing that the last rate they used.
  const suggestedRate =
    (used && used.date === draft.date ? used.rate : null) ?? reference.data?.rate ?? used?.rate ?? null;
  const rateHint = [
    reference.data
      ? es.documents.referenceRate(formatRate(reference.data.rate), reference.data.source)
      : null,
    used?.date ? es.documents.lastRate(formatRate(used.rate ?? 0), formatDate(used.date)) : null,
    es.documents.rateHint,
  ]
    .filter(Boolean)
    .join(' ');
  const itemCurrency = read.currency ?? account?.currency ?? DEFAULT_CURRENCY;
  // Wait for both sources, so an old rate is not filled in just before the better one arrives.
  const suggestionsReady = !lastRate.isLoading && !reference.isLoading;

  // Start from the suggested rate; the user confirms or changes it.
  // Runs when a suggestion arrives or the currency changes, not on every keystroke.
  useEffect(() => {
    if (foreignCurrency && draft.rate === '' && suggestedRate && suggestionsReady) {
      const rate = formatRate(suggestedRate);
      onChange({ rate, amount: convertedAmount(read, rate) });
    }
  }, [foreignCurrency, suggestedRate, suggestionsReady]);

  return (
    <Card className={draft.include ? '' : 'opacity-60'}>
      <label className="flex items-center justify-between gap-3">
        <span className="font-semibold">
          {total > 1 ? es.documents.movement(index + 1, total) : es.documents.include}
        </span>
        <input
          type="checkbox"
          className="size-5"
          aria-label={es.documents.include}
          checked={draft.include}
          onChange={(event) => onChange({ include: event.target.checked })}
        />
      </label>

      {duplicate ? (
        <div className="mt-3">
          <Notice tone="attention">{es.documents.duplicate[duplicate]}</Notice>
        </div>
      ) : null}

      {draft.include ? (
        <div className="mt-3 space-y-3">
          {read.merchant ? (
            <p className="text-sm text-muted">
              {es.documents.merchant}: {read.merchant}
            </p>
          ) : null}
          {doubtful.length > 0 ? (
            <Notice tone="attention">{es.documents.doubtful(doubtful.join(', '))}</Notice>
          ) : null}

          <fieldset className="grid grid-cols-3 gap-1 rounded-2xl bg-paper p-1">
            <legend className="sr-only">{es.transactions.fields.type}</legend>
            {TRANSACTION_TYPES.map((option) => (
              <label
                key={option}
                className={`flex min-h-10 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ${
                  draft.type === option ? 'bg-primary text-on-primary' : 'text-muted'
                }`}
              >
                <input
                  type="radio"
                  name={`type-${index}`}
                  value={option}
                  checked={draft.type === option}
                  onChange={() => onChange({ type: option, categoryId: '', remember: false })}
                  className="sr-only"
                />
                {es.types[option]}
              </label>
            ))}
          </fieldset>

          {foreign && account ? (
            <>
              <Notice tone="attention">
                {es.documents.foreign(formatMoney(foreign.amountCents, foreign.currency), account.currency)}
              </Notice>
              <Button
                variant="quiet"
                className="px-0"
                onClick={() => onChange({ sameCurrency: true, amount: readAmount(read) })}
              >
                {es.documents.notForeign(account.currency)}
              </Button>
              <Field
                label={es.documents.rate(foreign.currency, account.currency)}
                hint={rateHint}
                error={errors.rate}
              >
                <TextInput
                  inputMode="decimal"
                  placeholder="0,00"
                  className="amount"
                  value={draft.rate}
                  onChange={(event) =>
                    onChange({ rate: event.target.value, amount: convertedAmount(read, event.target.value) })
                  }
                />
              </Field>
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={
                foreign && account
                  ? `${es.transactions.fields.amount} (${account.currency})`
                  : es.transactions.fields.amount
              }
              error={errors.amount}
            >
              <TextInput
                inputMode="decimal"
                placeholder="0,00"
                className="amount font-semibold"
                value={draft.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
              />
            </Field>
            <Field label={es.transactions.fields.date} error={errors.date}>
              <TextInput
                type="date"
                max={todayIso(DEFAULT_TIMEZONE)}
                value={draft.date}
                onChange={(event) => onChange({ date: event.target.value })}
              />
            </Field>
          </div>

          <Field label={es.transactions.fields.account} error={errors.accountId}>
            <Select
              value={draft.accountId}
              onChange={(event) => onChange(withAccount(draft, read, accounts, event.target.value))}
            >
              <option value="" />
              {accounts.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.currency})
                </option>
              ))}
            </Select>
          </Field>
          {account && read.currency && read.currency !== account.currency && !foreign ? (
            <>
              <Notice tone="attention">
                {es.documents.currencyMismatch(read.currency, account.currency)}
              </Notice>
              {draft.sameCurrency ? (
                <Button
                  variant="quiet"
                  className="px-0"
                  onClick={() => onChange({ sameCurrency: false, amount: convertedAmount(read, draft.rate) })}
                >
                  {es.documents.convertAgain(read.currency, account.currency)}
                </Button>
              ) : null}
            </>
          ) : null}

          {isTransfer ? (
            <Field label={es.transactions.fields.toAccount} error={errors.toAccountId}>
              <Select
                value={draft.toAccountId}
                onChange={(event) => onChange({ toAccountId: event.target.value })}
              >
                <option value="" />
                {accounts
                  .filter((option) => option.id !== draft.accountId)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.currency})
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field
              label={es.transactions.fields.category}
              hint={keptRuleCategory ? es.documents.fromRule : undefined}
              error={errors.categoryId}
            >
              <Select
                value={draft.categoryId}
                onChange={(event) => onChange({ categoryId: event.target.value, remember: false })}
              >
                <option value="">{es.transactions.noCategory}</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {optionLabel(category)}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {crossCurrency ? (
            <Field
              label={`${es.transactions.fields.toAmount} (${destination?.currency ?? ''})`}
              error={errors.toAmount}
            >
              <TextInput
                inputMode="decimal"
                placeholder="0,00"
                className="amount"
                value={draft.toAmount}
                onChange={(event) => onChange({ toAmount: event.target.value })}
              />
            </Field>
          ) : null}

          {canRemember ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={draft.remember}
                onChange={(event) => onChange({ remember: event.target.checked })}
              />
              {es.documents.remember(read.merchant)}
            </label>
          ) : null}

          {account?.type === 'credit_card' ? (
            <Field
              label={`${es.transactions.fields.paymentDate} (${es.common.optional})`}
              hint={es.transactions.fields.paymentDateHint}
              error={errors.paymentDate}
            >
              <TextInput
                type="date"
                value={draft.paymentDate}
                onChange={(event) => onChange({ paymentDate: event.target.value })}
              />
            </Field>
          ) : null}

          <Field label={es.transactions.fields.description} error={errors.description}>
            <TextInput
              maxLength={TEXT_LIMITS.description}
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>

          {read.installment ? (
            <p className="text-sm text-muted">
              {es.transactions.installment(read.installment.number, read.installment.total)}
            </p>
          ) : null}

          {read.installment &&
          canContinue(read) &&
          account?.type === 'credit_card' &&
          draft.type === 'expense' ? (
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={draft.continuePlan}
                  onChange={(event) => onChange({ continuePlan: event.target.checked })}
                />
                {es.documents.continuePlan(read.installment.number + 1, read.installment.total)}
              </label>
              <p className="mt-1 text-sm text-muted">{es.documents.continuePlanHint}</p>
            </div>
          ) : null}

          {draft.type === 'expense' && !read.installment ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={draft.refund}
                onChange={(event) => onChange({ refund: event.target.checked })}
              />
              {es.transactions.refund}
            </label>
          ) : null}

          {draft.type === 'transfer' ? null : (
            <ItemsEditor
              items={draft.items}
              onChange={(items) => onChange({ items })}
              currency={itemCurrency}
              totalCents={foreign ? foreign.amountCents : parseAmountToCents(draft.amount)}
              error={errors.items}
            />
          )}
        </div>
      ) : null}
    </Card>
  );
}

function ReviewForm({
  document,
  accounts,
  categories,
}: {
  document: DocumentDetail;
  accounts: Account[];
  categories: Category[];
}) {
  const navigate = useNavigate();
  const { confirm, discard, retry } = useDocumentMutations();
  const read = document.extraction?.transactions ?? [];
  const statement = document.extraction?.statement ?? null;
  const isAccountStatement = document.kind === 'account_statement';
  const statementCurrency = statement?.currency ?? DEFAULT_CURRENCY;
  // A statement's lines in dollars go to the same card's dollar account, when there is one.
  const card = sameCard(
    accounts.find((account) => account.id === document.accountId),
    accounts,
  );
  const startingAccount = (transaction: ReviewTransaction) =>
    card.find((account) => account.currency === transaction.currency)?.id ?? document.accountId;
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    read.map((transaction, index) => {
      const draft = toDraft(transaction, startingAccount(transaction), accounts);
      // A movement that looks repeated starts unticked: the app proposes, the user decides.
      const repeated = Boolean(document.duplicateHints[index]);
      return { ...draft, include: !repeated, continuePlan: draft.continuePlan && !repeated };
    }),
  );
  // Closing and due dates belong to a card's statement only.
  const [periods, setPeriods] = useState<PeriodDraft[]>(() =>
    isAccountStatement
      ? []
      : toPeriodDrafts(
          statement,
          card.map((account) => account.id),
        ),
  );
  const [errors, setErrors] = useState<Record<number, DraftErrors>>({});
  const [periodErrors, setPeriodErrors] = useState<Record<number, PeriodErrors>>({});
  const { failure, setFailure, run } = useAction();
  /** Products corrected here are offered for the same receipt line next time, unless the user says no. */
  const [rememberProducts, setRememberProducts] = useState(true);

  const changePeriod = (index: number, changes: Partial<PeriodDraft>) => {
    setPeriods((current) =>
      current.map((period, position) => (position === index ? { ...period, ...changes } : period)),
    );
    setPeriodErrors((current) => ({ ...current, [index]: {} }));
    setFailure(null);
  };

  const change = (index: number, changes: Partial<Draft>) => {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...changes } : draft)),
    );
    setErrors((current) => ({ ...current, [index]: {} }));
    setFailure(null);
  };
  const setAccountForAll = (accountId: string) => {
    // On a statement the choice is a card: its dollar lines go to its dollar
    // account, and its dates are offered for that card unless some were already ticked.
    const chosen =
      statement && !isAccountStatement
        ? sameCard(
            accounts.find((account) => account.id === accountId),
            accounts,
          )
        : [];
    setDrafts((current) =>
      current.map((draft, index) => {
        // On an account's statement, what came in from another account arrived in this one.
        if (isAccountStatement && isIncoming(read[index]!)) return { ...draft, toAccountId: accountId };
        const twin = chosen.find((account) => account.currency === read[index]!.currency);
        return withAccount(draft, read[index]!, accounts, twin?.id ?? accountId);
      }),
    );
    if (chosen.length > 0) {
      setPeriods((current) =>
        current.map((period) =>
          period.accountIds.length === 0
            ? { ...period, accountIds: chosen.map((account) => account.id) }
            : period,
        ),
      );
    }
    setErrors({});
    setFailure(null);
  };

  const included = drafts.flatMap((draft, index) => (draft.include ? [index] : []));

  /** The products of the ticked movements kept with another product or group than the one read. */
  const correctedProducts = included.flatMap((index) => {
    const kept = fromItemDrafts(drafts[index]!.items).items;
    return kept ? productCorrections(read[index]!.items, kept) : [];
  });

  /** What the ticked movements add up to in the statement's currency: purchases minus refunds. */
  const tickedCents = included.reduce((sum, index) => {
    const draft = drafts[index]!;
    const account = accounts.find((candidate) => candidate.id === draft.accountId);
    const cents = parseAmountToCents(draft.amount);
    if (!account || account.currency !== statementCurrency || cents === null || draft.type === 'transfer')
      return sum;
    return draft.type === 'expense'
      ? sum + spendingCents({ refund: draft.refund, amountCents: cents })
      : sum - cents;
  }, 0);

  const submit = async () => {
    setFailure(null);
    const found: Record<number, DraftErrors> = {};
    const flag = (index: number, field: keyof Draft, message: string | undefined) => {
      found[index] = { ...found[index], [field]: message ?? es.fieldMessages.invalid };
    };
    if (included.length === 0) {
      setFailure(es.documents.noneIncluded);
      return;
    }

    const entries = included.map((index) => {
      const draft = drafts[index]!;
      const source = read[index]!;
      const account = accounts.find((candidate) => candidate.id === draft.accountId);
      const destination = accounts.find((candidate) => candidate.id === draft.toAccountId);
      const isTransfer = draft.type === 'transfer';
      const crossCurrency =
        isTransfer && Boolean(account && destination && account.currency !== destination.currency);
      const amountCents = parseAmountToCents(draft.amount);
      const toAmountCents = crossCurrency ? parseAmountToCents(draft.toAmount) : null;

      const foreign = draft.sameCurrency ? null : foreignAmount(source, account);
      const validAmount = amountCents !== null && amountCents > 0;
      if (!validAmount && foreign && parseRate(draft.rate) === null)
        flag(index, 'rate', es.documents.rateMissing);
      else if (!validAmount) flag(index, 'amount', es.fieldMessages.amount);
      // The stored rate is the one that really links both amounts, even if the total was adjusted by hand.
      const rate = foreign && validAmount ? impliedRate(amountCents, foreign.amountCents) : null;
      if (crossCurrency && (toAmountCents === null || toAmountCents <= 0))
        flag(index, 'toAmount', es.fieldMessages.amount);
      if (!draft.date) flag(index, 'date', es.fieldMessages.required);
      if (!account) flag(index, 'accountId', es.fieldMessages.required);
      const readItems = fromItemDrafts(isTransfer ? [] : draft.items);
      if (readItems.error !== null) flag(index, 'items', readItems.error);
      // Products are stored in the same currency as their transaction.
      const items = (readItems.items ?? []).map((item) =>
        rate ? { ...item, amountCents: convertCents(item.amountCents, rate) } : item,
      );

      return {
        transaction: {
          type: draft.type,
          refund: draft.type === 'expense' && draft.refund,
          date: draft.date,
          amountCents: amountCents ?? 0,
          currency: account?.currency ?? DEFAULT_CURRENCY,
          accountId: draft.accountId,
          categoryId: isTransfer ? null : draft.categoryId || null,
          description: draft.description,
          note: '',
          tagIds: [],
          toAccountId: isTransfer ? draft.toAccountId || null : null,
          toAmountCents,
          paymentDate: account?.type === 'credit_card' ? draft.paymentDate || null : null,
          original: foreign && rate ? { ...foreign, rate } : null,
          items,
        },
        installment: source.installment,
        continuePlan:
          draft.continuePlan &&
          canContinue(source) &&
          draft.type === 'expense' &&
          account?.type === 'credit_card',
      };
    });

    const rules = included.flatMap((index) => {
      const draft = drafts[index]!;
      const merchant = read[index]!.merchant;
      return draft.remember && draft.categoryId && merchant
        ? [{ merchant, categoryId: draft.categoryId }]
        : [];
    });

    const kept = fromPeriodDrafts(periods);
    const foundInPeriods: Record<number, PeriodErrors> = { ...kept.errors };

    if (Object.keys(found).length === 0 && Object.keys(foundInPeriods).length === 0) {
      const parsed = documentConfirmSchema.safeParse({
        transactions: entries,
        rules,
        productRules: rememberProducts ? correctedProducts : [],
        cardPeriods: kept.periods,
      });
      if (parsed.success) {
        const saved = await run(() => confirm.mutateAsync({ id: document.id, input: parsed.data }), {
          onError: (error) => {
            if (error instanceof ApiError && error.code === 'DUPLICATE') {
              setFailure(es.documents.periodExists);
              return true;
            }
            // The server names the position of the transaction it rejected.
            const details =
              error instanceof ApiError ? (error.details as ServerRejection | undefined) : undefined;
            const position = details?.index === undefined ? undefined : included[details.index];
            if (position === undefined || !details?.cause?.issues) return false;
            for (const issue of details.cause.issues) {
              const key = issue.path.split('.')[0] ?? '';
              flag(position, FIELD_OF[key] ?? (key as keyof Draft), fieldMessage(issue.message));
            }
            setErrors(found);
            setPeriodErrors(foundInPeriods);
            setFailure(es.documents.fixErrors);
            return true;
          },
        });
        if (saved) void navigate('/movimientos');
        return;
      } else {
        for (const issue of parsed.error.issues) {
          if (issue.path[0] === 'cardPeriods') {
            // Paths look like: cardPeriods.<n>.<field>
            const index = kept.positions[Number(issue.path[1])];
            const key = String(issue.path[2] ?? 'closingDate') as keyof PeriodDraft;
            if (index !== undefined)
              foundInPeriods[index] = { ...foundInPeriods[index], [key]: fieldMessage(issue.message) };
            continue;
          }
          // Paths look like: transactions.<n>.transaction.<field>
          const [, position, , key] = issue.path.map(String);
          const index = included[Number(position)];
          if (index !== undefined && key)
            flag(index, FIELD_OF[key] ?? (key as keyof Draft), fieldMessage(issue.message));
        }
      }
    }
    setErrors(found);
    setPeriodErrors(foundInPeriods);
    setFailure(es.documents.fixErrors);
  };

  const discardDocument = async () => {
    if (!window.confirm(es.documents.discardConfirm)) return;
    if (await run(discard.mutateAsync(document.id))) void navigate('/pendientes');
  };

  /** Throws away what was read and asks the AI again; the screen follows the document's status. */
  const reread = async () => {
    await run(retry.mutateAsync(document.id));
  };

  const activeAccounts = accounts.filter((account) => !account.archived);
  // The account a bank's or an app's statement is about: the one chosen on upload, or the first one used.
  const statementAccount = accounts.find(
    (account) => account.id === (document.accountId ?? drafts.find((draft) => draft.accountId)?.accountId),
  );

  return (
    <div className="space-y-4">
      {document.text ? (
        <details className="rounded-2xl bg-surface shadow-card p-3">
          <summary className="cursor-pointer font-semibold">{es.documents.sentText}</summary>
          <pre className="mt-2 max-h-[60dvh] overflow-auto whitespace-pre-wrap text-sm">{document.text}</pre>
        </details>
      ) : (
        <div className="max-h-[60dvh] space-y-2 overflow-y-auto rounded-2xl">
          {Array.from({ length: document.fileCount }, (_, index) => (
            <DocumentImage key={index} documentId={document.id} index={index} />
          ))}
        </div>
      )}

      {periods.length > 0 ? (
        <StatementSection
          drafts={periods}
          errors={periodErrors}
          cards={activeAccounts.filter((account) => account.type === 'credit_card')}
          ticked={{ cents: tickedCents, currency: statementCurrency }}
          onChange={changePeriod}
        />
      ) : null}

      {isAccountStatement && statement ? (
        <BalanceCheck
          account={statementAccount}
          statement={statement}
          tickedCents={statementAccount ? netFor(statementAccount.id, drafts) : 0}
        />
      ) : null}

      {(document.extraction?.warnings ?? []).map((warning) => (
        <Notice key={warning} tone="attention">
          {warning}
        </Notice>
      ))}

      {read.length === 0 ? <Notice>{es.documents.nothingFound}</Notice> : null}

      {read.length > 1 ? (
        <Field label={es.documents.accountForAll}>
          <Select value="" onChange={(event) => event.target.value && setAccountForAll(event.target.value)}>
            <option value="" />
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {read.map((transaction, index) => (
        <TransactionCard
          key={index}
          index={index}
          total={read.length}
          read={transaction}
          draft={drafts[index]!}
          errors={errors[index] ?? {}}
          accounts={activeAccounts}
          categories={categories}
          duplicate={document.duplicateHints[index] ?? null}
          onChange={(changes) => change(index, changes)}
        />
      ))}

      {correctedProducts.length > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={rememberProducts}
            onChange={(event) => setRememberProducts(event.target.checked)}
          />
          {es.documents.rememberProducts(correctedProducts.length)}
        </label>
      ) : null}

      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <p className="text-sm text-muted">{document.text ? es.statement.keepText : es.add.keepPhoto}</p>

      <div className="flex gap-2">
        {read.length > 0 ? (
          <Button
            className="flex-1"
            disabled={confirm.isPending || included.length === 0}
            onClick={() => void submit()}
          >
            {confirm.isPending ? es.common.saving : es.documents.confirm(included.length)}
          </Button>
        ) : null}
        <Button variant="danger" disabled={discard.isPending} onClick={() => void discardDocument()}>
          {es.documents.discard}
        </Button>
      </div>
      <Button variant="quiet" className="w-full" disabled={retry.isPending} onClick={() => void reread()}>
        {es.documents.reread}
      </Button>
    </div>
  );
}

interface ServerRejection {
  index?: number;
  cause?: { issues?: { path: string; message: string }[] };
}

/** Review screen: the image on top, what was read below, nothing saved until confirmed. */
export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const document = useDocument(id);
  const accounts = useAccounts();
  const categories = useCategories();
  const status = document.data?.status;

  // A document that is no longer waiting for review has nothing to show here.
  useEffect(() => {
    if (status === 'confirmed' || status === 'error') void navigate('/pendientes', { replace: true });
  }, [status, navigate]);

  if (document.error) return <Notice tone="error">{errorMessage(document.error)}</Notice>;
  if (!document.data || !accounts.data || !categories.data) return <Loading />;

  return (
    <>
      <PageTitle>{es.documents.reviewTitle}</PageTitle>
      {document.data.status === 'processing' ? (
        <Notice>{es.documents.statuses.processing}</Notice>
      ) : document.data.status === 'ready' ? (
        // Keyed by update time so a re-read document starts from fresh drafts.
        <ReviewForm
          key={`${document.data.id}-${document.data.updatedAt}`}
          document={document.data}
          accounts={accounts.data}
          categories={categories.data}
        />
      ) : null}
    </>
  );
}
