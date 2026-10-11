import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ACCOUNT_TYPES, CURRENCIES, accountCreateSchema, type AccountCreate } from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAccountMutations, useAccounts } from './api';

export function AccountsPage() {
  const accounts = useAccounts();
  const { create, update, remove } = useAccountMutations();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<AccountCreate>({ defaultValues: { name: '', type: 'bank', currency: 'ARS' } });

  const run = async (work: Promise<unknown>) => {
    setFailure(null);
    try {
      await work;
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const parsed = accountCreateSchema.safeParse(values);
    if (!parsed.success) {
      form.setError('name', { message: es.fieldMessages.required });
      return;
    }
    await run(create.mutateAsync(parsed.data).then(() => form.reset()));
  });

  return (
    <>
      <PageTitle>{es.accounts.title}</PageTitle>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={accounts} empty={es.accounts.empty}>
        {(items) => (
          <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 p-3">
                <div className={account.archived ? 'opacity-60' : ''}>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted">
                    {es.accountTypes[account.type]}, {account.currency}
                    {account.archived ? `, ${es.common.archived.toLowerCase()}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="quiet"
                    onClick={() =>
                      void run(
                        update.mutateAsync({ id: account.id, changes: { archived: !account.archived } }),
                      )
                    }
                  >
                    {account.archived ? es.common.unarchive : es.common.archive}
                  </Button>
                  <Button
                    variant="quiet"
                    className="text-expense"
                    onClick={() => void run(remove.mutateAsync(account.id))}
                  >
                    {es.common.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{es.accounts.newTitle}</h2>
        <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
          <Field label={es.accounts.name} error={form.formState.errors.name?.message}>
            <TextInput {...form.register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={es.accounts.type}>
              <Select {...form.register('type')}>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {es.accountTypes[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={es.accounts.currency}>
              <Select {...form.register('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-sm text-muted">{es.accounts.fixedHint}</p>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? es.common.saving : es.common.add}
          </Button>
        </form>
      </Card>
    </>
  );
}
