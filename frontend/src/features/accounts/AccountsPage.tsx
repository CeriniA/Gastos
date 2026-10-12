import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import {
  ACCOUNT_TYPES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  accountCreateSchema,
  type Account,
  type AccountType,
  type Currency,
  type Institution,
  type InstitutionKind,
  TEXT_LIMITS,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { useAction } from '../../shared/ui/useAction';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useInstitutions } from '../institutions/api';
import { useAccountMutations, useAccounts } from './api';

interface FormValues {
  name: string;
  type: AccountType;
  currency: Currency;
  bankId: string;
  networkId: string;
}

/** A select of banks or card brands; archived ones only when already chosen. */
function InstitutionSelect({
  kind,
  institutions,
  value,
  onChange,
}: {
  kind: InstitutionKind;
  institutions: readonly Institution[];
  value: string;
  onChange: (id: string) => void;
}) {
  const options = institutions.filter(
    (institution) => institution.kind === kind && (!institution.archived || institution.id === value),
  );
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{es.common.none}</option>
      {options.map((institution) => (
        <option key={institution.id} value={institution.id}>
          {institution.name}
        </option>
      ))}
    </Select>
  );
}

function AccountEditor({
  account,
  institutions,
  busy,
  onSave,
  onClose,
}: {
  account: Account;
  institutions: readonly Institution[];
  busy: boolean;
  onSave: (changes: { name: string; bankId: string | null; networkId: string | null }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [bankId, setBankId] = useState(account.bankId ?? '');
  const [networkId, setNetworkId] = useState(account.networkId ?? '');
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const done = await onSave({ name, bankId: bankId || null, networkId: networkId || null });
    if (done) onClose();
  };
  return (
    <form
      onSubmit={(event) => void save(event)}
      className="space-y-3 border-t border-line bg-paper p-3"
      noValidate
    >
      <Field label={es.accounts.name}>
        <TextInput
          value={name}
          maxLength={TEXT_LIMITS.name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={es.accounts.bank}>
          <InstitutionSelect kind="bank" institutions={institutions} value={bankId} onChange={setBankId} />
        </Field>
        {account.type === 'credit_card' ? (
          <Field label={es.accounts.network}>
            <InstitutionSelect
              kind="network"
              institutions={institutions}
              value={networkId}
              onChange={setNetworkId}
            />
          </Field>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy || !name.trim()}>
          {es.common.save}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {es.common.cancel}
        </Button>
      </div>
    </form>
  );
}

export function AccountsPage() {
  const accounts = useAccounts();
  const institutions = useInstitutions();
  const { create, update, remove } = useAccountMutations();
  const { failure, run } = useAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const form = useForm<FormValues>({
    defaultValues: { name: '', type: 'bank', currency: DEFAULT_CURRENCY, bankId: '', networkId: '' },
  });
  const type = form.watch('type');
  const all = institutions.data ?? [];
  const busy = create.isPending || update.isPending || remove.isPending;

  const nameOf = (id: string | null) => all.find((institution) => institution.id === id)?.name;

  const submit = form.handleSubmit(async (values) => {
    const parsed = accountCreateSchema.safeParse({
      ...values,
      bankId: values.type === 'cash' ? null : values.bankId || null,
      networkId: values.type === 'credit_card' ? values.networkId || null : null,
    });
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
              <li key={account.id}>
                <div className="flex items-center justify-between gap-3 p-3">
                  <div className={`min-w-0 ${account.archived ? 'opacity-60' : ''}`}>
                    <p className="break-words font-medium">{account.name}</p>
                    <p className="text-sm text-muted">
                      {[
                        es.accountTypes[account.type],
                        account.currency,
                        nameOf(account.networkId),
                        nameOf(account.bankId),
                        account.archived ? es.common.archived.toLowerCase() : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end">
                    <Button
                      variant="quiet"
                      className="px-2"
                      onClick={() => setEditingId(editingId === account.id ? null : account.id)}
                    >
                      {es.common.edit}
                    </Button>
                    <Button
                      variant="quiet"
                      className="px-2"
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
                      className="px-2 text-expense"
                      onClick={() => void run(remove.mutateAsync(account.id))}
                    >
                      {es.common.delete}
                    </Button>
                  </div>
                </div>
                {editingId === account.id ? (
                  <AccountEditor
                    account={account}
                    institutions={all}
                    busy={busy}
                    onClose={() => setEditingId(null)}
                    onSave={(changes) => run(update.mutateAsync({ id: account.id, changes }))}
                  />
                ) : null}
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
                {ACCOUNT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {es.accountTypes[option]}
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
          {type === 'cash' ? null : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={es.accounts.bank}>
                <InstitutionSelect
                  kind="bank"
                  institutions={all}
                  value={form.watch('bankId')}
                  onChange={(id) => form.setValue('bankId', id)}
                />
              </Field>
              {type === 'credit_card' ? (
                <Field label={es.accounts.network}>
                  <InstitutionSelect
                    kind="network"
                    institutions={all}
                    value={form.watch('networkId')}
                    onChange={(id) => form.setValue('networkId', id)}
                  />
                </Field>
              ) : null}
            </div>
          )}
          {type === 'credit_card' ? <p className="text-sm text-muted">{es.accounts.cardHint}</p> : null}
          <p className="text-sm text-muted">{es.accounts.fixedHint}</p>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? es.common.saving : es.common.add}
          </Button>
        </form>
      </Card>
    </>
  );
}
