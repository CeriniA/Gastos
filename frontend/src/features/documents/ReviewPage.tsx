import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  TRANSACTION_TYPES,
  centsToDecimalString,
  convertCents,
  documentConfirmSchema,
  formatDate,
  formatMoney,
  formatRate,
  parseAmountToCents,
  parseRate,
  todayIso,
  type Account,
  type Category,
  type DocumentDetail,
  type DuplicateHint,
  type ReviewTransaction,
  type TransactionType,
} from '@gastos/shared';
import { ApiError } from '../../shared/api/client';
import { errorMessage, fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Button, Card, Field, Loading, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { useLastRate, useReferenceRate } from '../transactions/api';
import { DocumentImage } from './DocumentImage';
import { useDocument, useDocumentMutations } from './api';

/** One extracted transaction as the user is editing it. Everything is text until confirmed. */
interface Draft {
  include: boolean;
  type: TransactionType;
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

function toDraft(
  transaction: ReviewTransaction,
  accountId: string | null,
  accounts: readonly Account[],
): Draft {
  const draft: Draft = {
    include: true,
    type: transaction.type,
    amount: readAmount(transaction),
    date: transaction.date ?? '',
    accountId: '',
    toAccountId: '',
    toAmount: '',
    categoryId: transaction.suggestedCategoryId ?? '',
    description: (transaction.description || transaction.merchant).slice(0, 200),
    paymentDate: '',
    remember: false,
    rate: '',
    sameCurrency: false,
  };
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
  const itemCurrency = read.currency ?? account?.currency ?? 'ARS';
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

          <fieldset className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-paper p-1">
            <legend className="sr-only">{es.transactions.fields.type}</legend>
            {TRANSACTION_TYPES.map((option) => (
              <label
                key={option}
                className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-semibold ${
                  draft.type === option ? 'bg-income text-surface' : 'text-muted'
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
              maxLength={200}
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>

          {read.installment ? (
            <p className="text-sm text-muted">
              {es.transactions.installment(read.installment.number, read.installment.total)}
            </p>
          ) : null}

          {read.items.length > 0 ? (
            <details className="rounded-lg border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {es.documents.items(read.items.length)}
              </summary>
              <ul className="divide-y divide-line border-t border-line text-sm">
                {read.items.map((item, position) => (
                  <li key={position} className="flex justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0">
                      <span className="block break-words">{item.product || item.name}</span>
                      <span className="block break-words text-muted">
                        {[
                          item.group ? es.productGroups[item.group] : es.consumption.ungrouped,
                          item.product && item.product !== item.name ? item.name : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="amount shrink-0">{formatMoney(item.amountCents, itemCurrency)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
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
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    read.map((transaction, index) => ({
      ...toDraft(transaction, document.accountId, accounts),
      // A movement that looks repeated starts unticked: the app proposes, the user decides.
      include: !document.duplicateHints[index],
    })),
  );
  const [errors, setErrors] = useState<Record<number, DraftErrors>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const change = (index: number, changes: Partial<Draft>) => {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...changes } : draft)),
    );
    setErrors((current) => ({ ...current, [index]: {} }));
  };
  const setAccountForAll = (accountId: string) => {
    setDrafts((current) =>
      current.map((draft, index) => withAccount(draft, read[index]!, accounts, accountId)),
    );
    setErrors({});
  };

  const included = drafts.flatMap((draft, index) => (draft.include ? [index] : []));

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
      const rate = foreign && validAmount ? Number((amountCents / foreign.amountCents).toFixed(6)) : null;
      if (crossCurrency && (toAmountCents === null || toAmountCents <= 0))
        flag(index, 'toAmount', es.fieldMessages.amount);
      if (!draft.date) flag(index, 'date', es.fieldMessages.required);
      if (!account) flag(index, 'accountId', es.fieldMessages.required);

      return {
        transaction: {
          type: draft.type,
          date: draft.date,
          amountCents: amountCents ?? 0,
          currency: account?.currency ?? 'ARS',
          accountId: draft.accountId,
          categoryId: isTransfer ? null : draft.categoryId || null,
          description: draft.description,
          note: '',
          tagIds: [],
          splits: [],
          toAccountId: isTransfer ? draft.toAccountId || null : null,
          toAmountCents,
          paymentDate: account?.type === 'credit_card' ? draft.paymentDate || null : null,
          original: foreign && rate ? { ...foreign, rate } : null,
        },
        // Products are stored in the same currency as their transaction.
        items: rate
          ? source.items.map((item) => ({ ...item, amountCents: convertCents(item.amountCents, rate) }))
          : source.items,
        installment: source.installment,
      };
    });

    const rules = included.flatMap((index) => {
      const draft = drafts[index]!;
      const merchant = read[index]!.merchant;
      return draft.remember && draft.categoryId && merchant
        ? [{ merchant, categoryId: draft.categoryId }]
        : [];
    });

    if (Object.keys(found).length === 0) {
      const parsed = documentConfirmSchema.safeParse({ transactions: entries, rules });
      if (parsed.success) {
        try {
          await confirm.mutateAsync({ id: document.id, input: parsed.data });
          void navigate('/movimientos');
          return;
        } catch (error) {
          // The server names the position of the transaction it rejected.
          const details =
            error instanceof ApiError ? (error.details as ServerRejection | undefined) : undefined;
          const position = details?.index === undefined ? undefined : included[details.index];
          if (position === undefined || !details?.cause?.issues) {
            setFailure(errorMessage(error));
            return;
          }
          for (const issue of details.cause.issues) {
            const key = issue.path.split('.')[0] ?? '';
            flag(position, FIELD_OF[key] ?? (key as keyof Draft), fieldMessage(issue.message));
          }
        }
      } else {
        for (const issue of parsed.error.issues) {
          // Paths look like: transactions.<n>.transaction.<field>
          const [, position, , key] = issue.path.map(String);
          const index = included[Number(position)];
          if (index !== undefined && key)
            flag(index, FIELD_OF[key] ?? (key as keyof Draft), fieldMessage(issue.message));
        }
      }
    }
    setErrors(found);
    setFailure(es.documents.fixErrors);
  };

  const discardDocument = async () => {
    if (!window.confirm(es.documents.discardConfirm)) return;
    try {
      await discard.mutateAsync(document.id);
      void navigate('/pendientes');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  /** Throws away what was read and asks the AI again; the screen follows the document's status. */
  const reread = async () => {
    try {
      await retry.mutateAsync(document.id);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const activeAccounts = accounts.filter((account) => !account.archived);

  return (
    <div className="space-y-4">
      <div className="max-h-[60dvh] space-y-2 overflow-y-auto rounded-lg">
        {Array.from({ length: document.fileCount }, (_, index) => (
          <DocumentImage key={index} documentId={document.id} index={index} />
        ))}
      </div>

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

      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <p className="text-sm text-muted">{es.add.keepPhoto}</p>

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
