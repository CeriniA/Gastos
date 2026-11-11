import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  INSTALLMENT_CHOICES,
  TRANSACTION_TYPES,
  centsToDecimalString,
  convertCents,
  formatMoney,
  formatRate,
  impliedRate,
  parseAmountToCents,
  parseRate,
  todayIso,
  transactionCreateSchema,
  transactionUpdateSchema,
  type Transaction,
  type TransactionType,
  TEXT_LIMITS,
} from '@gastos/shared';
import { ApiError } from '../../shared/api/client';

import { errorMessage, fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Field, Loading, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAccounts } from '../accounts/api';
import { MarkFixed } from '../recurrings/MarkFixed';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { useMerchants, useProducts } from '../lists/api';
import { useCreateTag, useTags } from '../tags/api';
import { ItemsEditor, fromItemDrafts, toItemDrafts, type ItemDraft } from './ItemsEditor';
import { useTransaction, useTransactionMutations } from './api';

interface FormValues {
  type: TransactionType;
  /** Expenses only: money given back for a purchase. */
  refund: boolean;
  amount: string;
  date: string;
  accountId: string;
  toAccountId: string;
  toAmount: string;
  categoryId: string;
  merchantId: string;
  paymentDate: string;
  description: string;
  note: string;
  tagIds: string[];
}

/** Which form field shows a problem reported for a given payload field. */
const FIELD_OF: Record<string, keyof FormValues> = {
  amountCents: 'amount',
  toAmountCents: 'toAmount',
  currency: 'accountId',
};

function toFormValues(transaction: Transaction | undefined): FormValues {
  return {
    type: transaction?.type ?? 'expense',
    refund: transaction?.refund ?? false,
    amount: transaction ? centsToDecimalString(transaction.amountCents) : '',
    date: transaction?.date ?? todayIso(DEFAULT_TIMEZONE),
    accountId: transaction?.accountId ?? '',
    toAccountId: transaction?.toAccountId ?? '',
    toAmount: transaction?.toAmountCents ? centsToDecimalString(transaction.toAmountCents) : '',
    categoryId: transaction?.categoryId ?? '',
    merchantId: transaction?.merchantId ?? '',
    paymentDate: transaction && transaction.paymentDate !== transaction.date ? transaction.paymentDate : '',
    description: transaction?.description ?? '',
    note: transaction?.note ?? '',
    tagIds: transaction?.tagIds ?? [],
  };
}

export function TransactionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useTransaction(id);
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const merchants = useMerchants();
  const products = useProducts();
  const createTag = useCreateTag();
  const { create, update, remove, createInstallments, removePlan } = useTransactionMutations();
  /** How many installments a new card purchase is paid in. 1 is a single payment. */
  const [installments, setInstallments] = useState('1');
  const { failure, setFailure, run } = useAction();
  const [newTag, setNewTag] = useState('');
  /** The rate while the user types it. Null means: show the one the amounts imply. */
  const [rateText, setRateText] = useState<string | null>(null);

  const values = useMemo(() => toFormValues(existing.data), [existing.data]);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [itemsError, setItemsError] = useState<string | undefined>(undefined);
  /** Only products the user touched are sent, so a corrected rate can still rescale the stored ones. */
  const [itemsTouched, setItemsTouched] = useState(false);
  useEffect(() => {
    setItems(toItemDrafts(existing.data?.items ?? []));
    setItemsTouched(false);
  }, [existing.data]);
  const form = useForm<FormValues>({ values });
  const { errors, isSubmitting } = form.formState;

  const type = form.watch('type');
  const refund = form.watch('refund');
  const accountId = form.watch('accountId');
  const toAccountId = form.watch('toAccountId');
  const selectedTags = form.watch('tagIds');
  const amountText = form.watch('amount');

  const activeAccounts = (accounts.data ?? []).filter(
    (account) => !account.archived || account.id === existing.data?.accountId,
  );
  const account = activeAccounts.find((candidate) => candidate.id === accountId);
  const destination = activeAccounts.find((candidate) => candidate.id === toAccountId);
  const crossCurrency =
    type === 'transfer' && Boolean(account && destination && account.currency !== destination.currency);
  const isCard = account?.type === 'credit_card';
  const planId = existing.data?.installment?.planId ?? null;
  const canSplitInInstallments =
    !id && type === 'expense' && !refund && isCard;
  const categoryOptions =
    type === 'transfer'
      ? []
      : orderedTree(categories.data ?? [], type).filter(
          (category) => !category.archived || category.id === existing.data?.categoryId,
        );

  const original = existing.data?.original ?? null;
  const totalCents = parseAmountToCents(amountText) ?? 0;

  /** Choosing a merchant proposes its usual category, only when none was chosen yet. */
  const suggestCategory = (event: { target: { value: string } }) => {
    const usual = (merchants.data ?? []).find((merchant) => merchant.id === event.target.value)?.defaultCategoryId;
    if (usual && !form.getValues('categoryId')) form.setValue('categoryId', usual);
  };

  const showIssues = (issues: readonly { path: string; message: string }[]) => {
    for (const issue of issues) {
      const key = issue.path.split('.')[0] ?? '';
      const field = FIELD_OF[key] ?? (key in values ? (key as keyof FormValues) : null);
      if (field) form.setError(field, { message: fieldMessage(issue.message) });
      else setFailure(fieldMessage(issue.message));
    }
  };

  const submit = form.handleSubmit(async (input) => {
    setFailure(null);
    const amountCents = parseAmountToCents(input.amount);
    const toAmountCents = crossCurrency ? parseAmountToCents(input.toAmount) : null;
    if (amountCents === null || amountCents <= 0) {
      form.setError('amount', { message: es.fieldMessages.amount });
      return;
    }
    if (crossCurrency && (toAmountCents === null || toAmountCents <= 0)) {
      form.setError('toAmount', { message: es.fieldMessages.amount });
      return;
    }
    if (!account) {
      form.setError('accountId', { message: es.fieldMessages.required });
      return;
    }

    setItemsError(undefined);
    const readItems = fromItemDrafts(input.type === 'transfer' ? [] : items);
    if (readItems.error !== null) {
      setItemsError(readItems.error);
      return;
    }

    const payload = {
      type: input.type,
      // Only an expense can be one; changing the type clears the mark.
      refund: input.type === 'expense' && input.refund,
      date: input.date,
      amountCents,
      currency: account.currency,
      accountId: input.accountId,
      categoryId: input.type === 'transfer' ? null : input.categoryId || null,
      // Only an expense has a merchant.
      merchantId: input.type === 'expense' ? input.merchantId || null : null,
      description: input.description,
      note: input.note,
      tagIds: input.tagIds,
      toAccountId: input.type === 'transfer' ? input.toAccountId || null : null,
      toAmountCents,
      paymentDate: isCard ? input.paymentDate || null : null,
      // A transfer never has products; otherwise they go when new or when changed.
      ...(!id || itemsTouched || input.type === 'transfer' ? { items: readItems.items } : {}),
    };

    let save: () => Promise<unknown>;
    if (id) {
      const parsed = transactionUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        showIssues(
          parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        );
        return;
      }
      save = () => update.mutateAsync({ id, changes: parsed.data });
    } else {
      const parsed = transactionCreateSchema.safeParse(payload);
      if (!parsed.success) {
        showIssues(
          parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        );
        return;
      }
      const count = Number(installments);
      save =
        canSplitInInstallments && count >= 2
          ? () => createInstallments.mutateAsync({ transaction: parsed.data, installments: count })
          : () => create.mutateAsync(parsed.data);
    }
    // The server can reject single fields: those are marked on the form instead of shown as a banner.
    const saved = await run(save, {
      onError: (error) => {
        if (!(error instanceof ApiError) || error.issues.length === 0) return false;
        showIssues(error.issues);
        return true;
      },
    });
    if (saved) void navigate('/movimientos');
  });

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    await run(async () => {
      const tag = await createTag.mutateAsync({ name });
      form.setValue('tagIds', [...selectedTags, tag.id]);
      setNewTag('');
    });
  };

  const deletePlan = async (id: string) => {
    if (!window.confirm(es.installments.deleteAllConfirm)) return;
    if (await run(removePlan.mutateAsync(id))) void navigate('/movimientos');
  };

  const moveToTrash = async () => {
    if (!id || !window.confirm(es.transactions.deleteConfirm)) return;
    if (await run(remove.mutateAsync(id))) void navigate('/movimientos');
  };

  if (id && existing.isPending) return <Loading />;
  if (id && existing.error) return <Notice tone="error">{errorMessage(existing.error)}</Notice>;

  return (
    <>
      <PageTitle>{id ? es.transactions.editTitle : es.transactions.newTitle}</PageTitle>

      <QueryState query={accounts}>
        {(allAccounts) =>
          allAccounts.length === 0 ? (
            <Notice tone="attention">{es.transactions.needAccount}</Notice>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
              <fieldset className="grid grid-cols-3 gap-1 rounded-2xl bg-surface shadow-card p-1">
                <legend className="sr-only">{es.transactions.fields.type}</legend>
                {TRANSACTION_TYPES.map((option) => (
                  <label
                    key={option}
                    className={`flex min-h-10 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ${
                      type === option ? 'bg-primary text-on-primary' : 'text-muted'
                    }`}
                  >
                    <input type="radio" value={option} className="sr-only" {...form.register('type')} />
                    {es.types[option]}
                  </label>
                ))}
              </fieldset>

              <Field label={es.transactions.fields.amount} error={errors.amount?.message}>
                <TextInput
                  inputMode="decimal"
                  placeholder="0,00"
                  className="amount text-2xl font-semibold"
                  {...form.register('amount', { onChange: () => setRateText(null) })}
                />
              </Field>

              {original ? (
                <Field
                  label={es.documents.rate(original.currency, existing.data?.currency ?? '')}
                  hint={es.transactions.rateHint(formatMoney(original.amountCents, original.currency))}
                >
                  <TextInput
                    inputMode="decimal"
                    className="amount"
                    value={
                      rateText ??
                      (totalCents > 0 ? formatRate(impliedRate(totalCents, original.amountCents)) : '')
                    }
                    onChange={(event) => {
                      setRateText(event.target.value);
                      const rate = parseRate(event.target.value);
                      if (rate) {
                        form.setValue(
                          'amount',
                          centsToDecimalString(convertCents(original.amountCents, rate)),
                        );
                      }
                    }}
                  />
                </Field>
              ) : null}

              <Field label={es.transactions.fields.date} error={errors.date?.message}>
                <TextInput type="date" max={todayIso(DEFAULT_TIMEZONE)} {...form.register('date')} />
              </Field>

              <Field label={es.transactions.fields.account} error={errors.accountId?.message}>
                <Select {...form.register('accountId')}>
                  <option value="" />
                  {activeAccounts.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.currency})
                    </option>
                  ))}
                </Select>
              </Field>

              {type === 'expense' ? (
                <Field label={es.transactions.fields.merchant} error={errors.merchantId?.message}>
                  <Select {...form.register('merchantId', { onChange: suggestCategory })}>
                    <option value="">{es.transactions.noMerchant}</option>
                    {(merchants.data ?? [])
                      .filter((merchant) => !merchant.archived || merchant.id === existing.data?.merchantId)
                      .map((merchant) => (
                        <option key={merchant.id} value={merchant.id}>
                          {merchant.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              ) : null}

              {type === 'transfer' ? (
                <Field label={es.transactions.fields.toAccount} error={errors.toAccountId?.message}>
                  <Select {...form.register('toAccountId')}>
                    <option value="" />
                    {activeAccounts
                      .filter((option) => option.id !== accountId)
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} ({option.currency})
                        </option>
                      ))}
                  </Select>
                </Field>
              ) : (
                <div>
                  <Field label={es.transactions.fields.category} error={errors.categoryId?.message}>
                    <Select {...form.register('categoryId')}>
                      <option value="">{es.transactions.noCategory}</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {optionLabel(category)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}

              {crossCurrency ? (
                <Field
                  label={`${es.transactions.fields.toAmount} (${destination?.currency ?? ''})`}
                  error={errors.toAmount?.message}
                >
                  <TextInput
                    inputMode="decimal"
                    placeholder="0,00"
                    className="amount"
                    {...form.register('toAmount')}
                  />
                </Field>
              ) : null}

              {type === 'expense' && !existing.data?.installment ? (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-5" {...form.register('refund')} />
                    {es.transactions.refund}
                  </label>
                  <p className="mt-1 text-sm text-muted">{es.transactions.refundHint}</p>
                </div>
              ) : null}

              {canSplitInInstallments ? (
                <Field label={es.installments.label} hint={es.installments.hint}>
                  <Select value={installments} onChange={(event) => setInstallments(event.target.value)}>
                    {INSTALLMENT_CHOICES.map((count) => (
                      <option key={count} value={String(count)}>
                        {count === 1 ? es.installments.single : es.installments.option(count)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {existing.data?.installment ? (
                <div className="rounded-2xl bg-surface shadow-card p-3 text-sm">
                  <p className="font-medium">
                    {es.transactions.installment(
                      existing.data.installment.number,
                      existing.data.installment.total,
                    )}
                    {existing.data.status === 'projected' ? ` · ${es.installments.projected}` : ''}
                  </p>
                  <p className="text-muted">{es.installments.editHint}</p>
                  {planId ? (
                    <Button
                      variant="quietDanger"
                      className="px-0"
                      disabled={removePlan.isPending}
                      onClick={() => void deletePlan(planId)}
                    >
                      {es.installments.deleteAll}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {isCard ? (
                <Field
                  label={`${es.transactions.fields.paymentDate} (${es.common.optional})`}
                  hint={es.transactions.fields.paymentDateHint}
                  error={errors.paymentDate?.message}
                >
                  <TextInput type="date" {...form.register('paymentDate')} />
                </Field>
              ) : null}

              <Field
                label={`${es.transactions.fields.description} (${es.common.optional})`}
                error={errors.description?.message}
              >
                <TextInput maxLength={TEXT_LIMITS.description} {...form.register('description')} />
              </Field>

              <fieldset>
                <legend className="mb-1 text-sm font-medium text-muted">
                  {es.transactions.fields.tags} ({es.common.optional})
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(tags.data ?? []).map((tag) => (
                    <label
                      key={tag.id}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                        selectedTags.includes(tag.id)
                          ? 'border-primary bg-primary-soft text-primary-ink'
                          : 'border-line bg-surface text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={tag.id}
                        className="sr-only"
                        {...form.register('tagIds')}
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <TextInput
                    aria-label={es.transactions.fields.newTag}
                    placeholder={es.transactions.fields.newTag}
                    value={newTag}
                    maxLength={TEXT_LIMITS.name}
                    onChange={(event) => setNewTag(event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void addTag()}
                    disabled={createTag.isPending || !newTag.trim()}
                  >
                    {es.common.add}
                  </Button>
                </div>
              </fieldset>

              <Field
                label={`${es.transactions.fields.note} (${es.common.optional})`}
                error={errors.note?.message}
              >
                <TextInput maxLength={TEXT_LIMITS.note} {...form.register('note')} />
              </Field>

              {type === 'transfer' ? null : (
                <ItemsEditor
                  items={items}
                  onChange={(next) => {
                    setItems(next);
                    setItemsTouched(true);
                  }}
                  currency={account?.currency ?? existing.data?.currency ?? DEFAULT_CURRENCY}
                  totalCents={totalCents > 0 ? totalCents : null}
                  error={itemsError}
                  products={products.data ?? []}
                  categories={categoryOptions}
                />
              )}

              {failure ? <Notice tone="error">{failure}</Notice> : null}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? es.common.saving : es.common.save}
                </Button>
                <Button variant="secondary" onClick={() => void navigate(-1)}>
                  {es.common.cancel}
                </Button>
              </div>
              {id ? (
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => void moveToTrash()}
                  disabled={remove.isPending}
                >
                  {es.transactions.moveToTrash}
                </Button>
              ) : null}
              {existing.data ? <MarkFixed transaction={existing.data} /> : null}
            </form>
          )
        }
      </QueryState>
    </>
  );
}
