import { useState, type FormEvent } from 'react';
import {
  INSTITUTION_KINDS,
  institutionCreateSchema,
  type Institution,
  type InstitutionKind,
  TEXT_LIMITS,
} from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { InlineNameForm } from '../../shared/ui/InlineNameForm';
import { useAction } from '../../shared/ui/useAction';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Notice, PageTitle, Tabs, TextInput } from '../../shared/ui/ui';
import { useInstitutionMutations, useInstitutions } from './api';

function InstitutionRow({
  institution,
  busy,
  onRename,
  onArchive,
  onDelete,
}: {
  institution: Institution;
  busy: boolean;
  onRename: (name: string) => Promise<boolean>;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineNameForm
        initial={institution.name}
        label={es.institutions.name}
        busy={busy}
        onSave={onRename}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
      <span className={`min-w-0 break-words ${institution.archived ? 'text-muted line-through' : ''}`}>
        {institution.name}
      </span>
      <span className="flex shrink-0">
        <Button variant="quiet" className="px-2" onClick={() => setEditing(true)}>
          {es.common.rename}
        </Button>
        <Button variant="quiet" className="px-2" disabled={busy} onClick={onArchive}>
          {institution.archived ? es.common.unarchive : es.common.archive}
        </Button>
        <Button variant="quiet" className="px-2 text-expense" disabled={busy} onClick={onDelete}>
          {es.common.delete}
        </Button>
      </span>
    </li>
  );
}

/** The banks and card brands the accounts can be tied to. */
export function InstitutionsPage() {
  const institutions = useInstitutions();
  const { create, update, remove } = useInstitutionMutations();
  const [kind, setKind] = useState<InstitutionKind>('bank');
  const [newName, setNewName] = useState('');
  const { failure, setFailure, run } = useAction();
  const busy = create.isPending || update.isPending || remove.isPending;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = institutionCreateSchema.safeParse({ name: newName, kind });
    if (!parsed.success) {
      setFailure(fieldMessage('required'));
      return;
    }
    if (await run(() => create.mutateAsync(parsed.data))) setNewName('');
  };

  return (
    <>
      <PageTitle>{es.institutions.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.institutions.text}</p>

      <Tabs
        options={INSTITUTION_KINDS}
        value={kind}
        label={(option) => es.institutions.kinds[option]}
        onChange={setKind}
      />

      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <form onSubmit={(event) => void add(event)} className="mb-4 flex gap-2" noValidate>
        <TextInput
          aria-label={es.institutions.newName[kind]}
          placeholder={es.institutions.newName[kind]}
          value={newName}
          maxLength={TEXT_LIMITS.name}
          onChange={(event) => setNewName(event.target.value)}
        />
        <Button type="submit" className="shrink-0" disabled={busy || !newName.trim()}>
          {es.common.add}
        </Button>
      </form>

      <QueryState query={institutions}>
        {(all) => {
          const items = all.filter((institution) => institution.kind === kind);
          return items.length === 0 ? (
            <Notice>{es.institutions.empty}</Notice>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {items.map((institution) => (
                <InstitutionRow
                  key={institution.id}
                  institution={institution}
                  busy={busy}
                  onRename={(name) =>
                    run(() => update.mutateAsync({ id: institution.id, changes: { name } }))
                  }
                  onArchive={() =>
                    void run(() =>
                      update.mutateAsync({
                        id: institution.id,
                        changes: { archived: !institution.archived },
                      }),
                    )
                  }
                  onDelete={() => {
                    if (window.confirm(es.institutions.deleteConfirm(institution.name))) {
                      void run(() => remove.mutateAsync(institution.id));
                    }
                  }}
                />
              ))}
            </ul>
          );
        }}
      </QueryState>
    </>
  );
}
