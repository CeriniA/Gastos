import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  TRANSACTION_TYPES,
  centsToDecimalString,
  formatMoney,
  formatRate,
  parseAmountToCents,
  todayIso,
  transactionCreateSchema,
  transactionUpdateSchema,
  type Transaction,
  type TransactionType,
} from '@gastos/shared';
import { ApiError } from '../../shared/api/client';
import { errorMessage, fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Field, Loading, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { useCreateTag, useTags } from '../tags/api';
import { useTransaction, useTransactionMutations } from './api';

interface FormValues {
  type: TransactionType;
  amount: string;
  date: string;
  accountId: string;
  toAccountId: string;
  toAmount: string;
  categoryId: string;
  paymentDate: string;
  description: string;
  note: string;
  tagIds: string[];
  /** Parts of a transaction divided across categories. Empty when it has a single category. */
  splits: { categoryId: string; amount: string }[];
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
    amount: transaction ? centsToDecimalString(transaction.amountCents) : '',
    date: transaction?.date ?? todayIso(DEFAULT_TIMEZONE),
    accountId: transaction?.accountId ?? '',
    toAccountId: transaction?.toAccountId ?? '',
    toAmount: transaction?.toAmountCents ? centsToDecimalString(transaction.toAmountCents) : '',
    categoryId: transaction?.categoryId ?? '',
    paymentDate: transaction && transaction.paymentDate !== transaction.date ? transaction.paymentDate : '',
    description: transaction?.description ?? '',
    note: transaction?.note ?? '',
    tagIds: transaction?.tagIds ?? [],
    splits: (transaction?.splits ?? []).map((split) => ({
      categoryId: split.categoryId,
      amount: centsToDecimalString(split.amountCents),
    })),
  };
}

export function TransactionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useTransaction(id);
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const createTag = useCreateTag();
  const { create, update, remove } = useTransactionMutations();
  const [failure, setFailure] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  const values = useMemo(() => toFormValues(existing.data), [existing.data]);
  const form = useForm<FormValues>({ values });
  const { errors, isSubmitting } = form.formState;
  const splitFields = useFieldArray({ control: form.control, name: 'splits' });

  const type = form.watch('type');
  const accountId = form.watch('accountId');
  const toAccountId = form.watch('toAccountId');
  const selectedTags = form.watch('tagIds');
  const amountText = form.watch('amount');
  const splitValues = form.watch('splits');

  const activeAccounts = (accounts.data ?? []).filter(
    (account) => !account.archived || account.id === existing.data?.accountId,
  );
  const account = activeAccounts.find((candidate) => candidate.id === accountId);
  const destination = activeAccounts.find((candidate) => candidate.id === toAccountId);
  const crossCurrency =
    type === 'transfer' && Boolean(account && destination && account.currency !== destination.currency);
  const isCard = account?.type === 'credit_card';
  const isSplit = type !== 'transfer' && splitFields.fields.length > 0;
  const usedCategoryIds = [
    existing.data?.categoryId,
    ...(existing.data?.splits.map((split) => split.categoryId) ?? []),
  ];
  const categoryOptions =
    type === 'transfer'
      ? []
      : orderedTree(categories.data ?? [], type).filter(
          (category) => !category.archived || usedCategoryIds.includes(category.id),
        );

  // What is left to assign, so the parts can be made to add up before saving.
  const totalCents = parseAmountToCents(amountText) ?? 0;
  const assignedCents = splitValues.reduce((sum, part) => sum + (parseAmountToCents(part.amount) ?? 0), 0);
  const remainingCents = totalCents - assignedCents;

  const startSplit = () => {
    splitFields.replace([
      { categoryId: form.getValues('categoryId'), amount: form.getValues('amount') },
      { categoryId: '', amount: '' },
    ]);
  };
  const stopSplit = () => {
    form.setValue('categoryId', splitValues[0]?.categoryId ?? '');
    splitFields.replace([]);
  };

  const showIssues = (issues: readonly { path: string; message: string }[]) => {
    for (const issue of issues) {
      const key = issue.path.split('.')[0] ?? '';
      const field = FIELD_OF[key] ?? (key in values && key !== 'splits' ? (key as keyof FormValues) : null);
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

    const splits: { categoryId: string; amountCents: number }[] = [];
    if (input.type !== 'transfer') {
      for (const part of input.splits) {
        const cents = parseAmountToCents(part.amount);
        if (!part.categoryId || cents === null || cents <= 0) {
          setFailure(es.transactions.split.incomplete);
          return;
        }
        splits.push({ categoryId: part.categoryId, amountCents: cents });
      }
      if (splits.length === 1) {
        setFailure(es.transactions.split.needTwo);
        return;
      }
      if (splits.length > 0 && splits.reduce((sum, part) => sum + part.amountCents, 0) !== amountCents) {
        setFailure(es.transactions.split.mismatch);
        return;
      }
    }

    const payload = {
      type: input.type,
      date: input.date,
      amountCents,
      currency: account.currency,
      accountId: input.accountId,
      categoryId: input.type === 'transfer' || splits.length > 0 ? null : input.categoryId || null,
      description: input.description,
      note: input.note,
      tagIds: input.tagIds,
      splits,
      toAccountId: input.type === 'transfer' ? input.toAccountId || null : null,
      toAmountCents,
      paymentDate: isCard ? input.paymentDate || null : null,
    };

    try {
      if (id) {
        const parsed = transactionUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          showIssues(
            parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
          );
          return;
        }
        await update.mutateAsync({ id, changes: parsed.data });
      } else {
        const parsed = transactionCreateSchema.safeParse(payload);
        if (!parsed.success) {
          showIssues(
            parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
          );
          return;
        }
        await create.mutateAsync(parsed.data);
      }
      void navigate('/movimientos');
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) showIssues(error.issues);
      else setFailure(errorMessage(error));
    }
  });

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    try {
      const tag = await createTag.mutateAsync({ name });
      form.setValue('tagIds', [...selectedTags, tag.id]);
      setNewTag('');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const moveToTrash = async () => {
    if (!id || !window.confirm(es.transactions.deleteConfirm)) return;
    try {
      await remove.mutateAsync(id);
      void navigate('/movimientos');
    } catch (error) {
      setFailure(errorMessage(error));
    }
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
              <fieldset className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
                <legend className="sr-only">{es.transactions.fields.type}</legend>
                {TRANSACTION_TYPES.map((option) => (
                  <label
                    key={option}
                    className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-semibold ${
                      type === option ? 'bg-income text-surface' : 'text-muted'
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
                  {...form.register('amount')}
                />
              </Field>

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
              ) : isSplit ? (
                <fieldset className="space-y-2 rounded-lg border border-line bg-surface p-3">
                  <legend className="px-1 text-sm font-medium text-muted">
                    {es.transactions.split.title}
                  </legend>
                  {splitFields.fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Select
                          aria-label={es.transactions.fields.category}
                          {...form.register(`splits.${index}.categoryId`)}
                        >
                          <option value="" />
                          {categoryOptions.map((category) => (
                            <option key={category.id} value={category.id}>
                              {optionLabel(category)}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="w-28 shrink-0">
                        <TextInput
                          aria-label={es.transactions.fields.amount}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="amount"
                          {...form.register(`splits.${index}.amount`)}
                        />
                      </div>
                      <Button
                        variant="quiet"
                        className="shrink-0 px-2 text-expense"
                        aria-label={es.transactions.split.removePart}
                        onClick={() => splitFields.remove(index)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  <p
                    role="status"
                    className={`text-sm ${remainingCents === 0 ? 'text-muted' : 'font-medium text-expense'}`}
                  >
                    {remainingCents === 0
                      ? es.transactions.split.balanced
                      : remainingCents > 0
                        ? es.transactions.split.missing(
                            formatMoney(remainingCents, account?.currency ?? 'ARS'),
                          )
                        : es.transactions.split.excess(
                            formatMoney(-remainingCents, account?.currency ?? 'ARS'),
                          )}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        splitFields.append({
                          categoryId: '',
                          amount: remainingCents > 0 ? centsToDecimalString(remainingCents) : '',
                        })
                      }
                    >
                      {es.transactions.split.addPart}
                    </Button>
                    <Button variant="quiet" onClick={stopSplit}>
                      {es.transactions.split.stop}
                    </Button>
                  </div>
                </fieldset>
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
                  <Button variant="quiet" className="px-0" onClick={startSplit}>
                    {es.transactions.split.start}
                  </Button>
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
                <TextInput maxLength={200} {...form.register('description')} />
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
                          ? 'border-income bg-income-soft text-income'
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
                    maxLength={60}
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
                <TextInput maxLength={1000} {...form.register('note')} />
              </Field>

              {existing.data?.original ? (
                <p className="text-sm text-muted">
                  {es.transactions.original(
                    formatMoney(existing.data.original.amountCents, existing.data.original.currency),
                    formatRate(existing.data.original.rate),
                  )}
                </p>
              ) : null}

              {existing.data && existing.data.items.length > 0 ? (
                <details className="rounded-lg border border-line bg-surface">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    {es.transactions.itemsTitle(existing.data.items.length)}
                  </summary>
                  <ul className="divide-y divide-line border-t border-line text-sm">
                    {existing.data.items.map((item, position) => (
                      <li key={position} className="flex justify-between gap-3 px-3 py-1.5">
                        <span className="min-w-0 break-words">{item.product || item.name}</span>
                        <span className="amount shrink-0">
                          {formatMoney(item.amountCents, existing.data?.currency ?? 'ARS')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

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
            </form>
          )
        }
      </QueryState>
    </>
  );
}
