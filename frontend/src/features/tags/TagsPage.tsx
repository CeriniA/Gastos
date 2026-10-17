import { useState, type FormEvent } from 'react';
import { TEXT_LIMITS, tagInputSchema, type Tag } from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { InlineNameForm } from '../../shared/ui/InlineNameForm';
import { useAction } from '../../shared/ui/useAction';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, TextInput } from '../../shared/ui/ui';
import { useCreateTag, useTagMutations, useTags } from './api';

function TagRow({
  tag,
  busy,
  onRename,
  onDelete,
}: {
  tag: Tag;
  busy: boolean;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineNameForm
        initial={tag.name}
        label={es.tags.name}
        busy={busy}
        onSave={onRename}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 pl-3 pr-2">
      <span className="min-w-0 break-words font-medium">{tag.name}</span>
      <span className="flex shrink-0 gap-1">
        <Button variant="quiet" onClick={() => setEditing(true)}>
          {es.common.rename}
        </Button>
        <Button variant="quietDanger" disabled={busy} onClick={onDelete}>
          {es.common.delete}
        </Button>
      </span>
    </li>
  );
}

export function TagsPage() {
  const tags = useTags();
  const create = useCreateTag();
  const { rename, remove } = useTagMutations();
  const { failure, setFailure, run } = useAction();
  const [newName, setNewName] = useState('');
  const busy = create.isPending || rename.isPending || remove.isPending;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = tagInputSchema.safeParse({ name: newName });
    if (!parsed.success) {
      setFailure(fieldMessage('required'));
      return;
    }
    if (await run(() => create.mutateAsync(parsed.data))) setNewName('');
  };

  return (
    <>
      <PageTitle>{es.tags.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.tags.text}</p>

      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={tags}>
        {(items) =>
          items.length === 0 ? (
            <div className="mb-6">
              <Notice>{es.tags.empty}</Notice>
            </div>
          ) : (
            <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
              {items.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  busy={busy}
                  onRename={(name) => {
                    const parsed = tagInputSchema.safeParse({ name });
                    if (!parsed.success) return Promise.resolve(false);
                    return run(() => rename.mutateAsync({ id: tag.id, name: parsed.data.name }));
                  }}
                  onDelete={() => {
                    if (window.confirm(es.tags.deleteConfirm(tag.name))) {
                      void run(() => remove.mutateAsync(tag.id));
                    }
                  }}
                />
              ))}
            </ul>
          )
        }
      </QueryState>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{es.tags.newTitle}</h2>
        <form onSubmit={(event) => void add(event)} className="space-y-3" noValidate>
          <Field label={es.tags.name}>
            <TextInput
              value={newName}
              maxLength={TEXT_LIMITS.name}
              onChange={(event) => setNewName(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !newName.trim()}>
            {create.isPending ? es.common.saving : es.common.add}
          </Button>
        </form>
      </Card>
    </>
  );
}
