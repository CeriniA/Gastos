import { useState, type FormEvent } from 'react';
import { tagInputSchema, type Tag } from '@gastos/shared';
import { errorMessage, fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
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
  const [name, setName] = useState<string | null>(null);

  if (name === null) {
    return (
      <li className="flex items-center justify-between gap-3 py-2 pl-3 pr-2">
        <span className="min-w-0 break-words font-medium">{tag.name}</span>
        <span className="flex shrink-0 gap-1">
          <Button variant="quiet" onClick={() => setName(tag.name)}>
            {es.common.rename}
          </Button>
          <Button variant="quiet" className="text-expense" disabled={busy} onClick={onDelete}>
            {es.common.delete}
          </Button>
        </span>
      </li>
    );
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (await onRename(name)) setName(null);
  };
  return (
    <li className="p-3">
      <form onSubmit={(event) => void save(event)} className="flex gap-2">
        <TextInput
          aria-label={es.tags.name}
          value={name}
          maxLength={60}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {es.common.save}
        </Button>
        <Button variant="secondary" onClick={() => setName(null)}>
          {es.common.cancel}
        </Button>
      </form>
    </li>
  );
}

export function TagsPage() {
  const tags = useTags();
  const create = useCreateTag();
  const { rename, remove } = useTagMutations();
  const [failure, setFailure] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const busy = create.isPending || rename.isPending || remove.isPending;

  /** Runs a change and tells whether it went through. */
  const run = async (work: () => Promise<unknown>): Promise<boolean> => {
    setFailure(null);
    try {
      await work();
      return true;
    } catch (error) {
      setFailure(errorMessage(error));
      return false;
    }
  };

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
            <TextInput value={newName} maxLength={60} onChange={(event) => setNewName(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy || !newName.trim()}>
            {create.isPending ? es.common.saving : es.common.add}
          </Button>
        </form>
      </Card>
    </>
  );
}
