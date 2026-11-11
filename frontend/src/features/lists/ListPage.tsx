import { useState, type FormEvent } from 'react';
import { TEXT_LIMITS, type Category } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, TextArea, TextInput } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';

/** What a merchant and a product have in common: the screen shows and edits only this. */
export interface ListEntry {
  id: string;
  name: string;
  aliases: string[];
  archived: boolean;
  categoryId: string | null;
}

/** What the user types. The category is null when none is chosen. */
export interface ListDraft {
  name: string;
  categoryId: string | null;
  aliases: string[];
}

/** The texts of one list, from `es.lists`. */
export interface ListTexts {
  title: string;
  text: string;
  empty: string;
  newTitle: string;
  name: string;
  category: string;
  noCategory: string;
  aliases: string;
  aliasesHint: string;
  mergeText: string;
  mergeConfirm: (source: string, target: string) => string;
  deleteConfirm: (name: string) => string;
}

interface ListPageProps {
  texts: ListTexts;
  /** True when every entry needs a category (a product); false when it is optional (a merchant). */
  categoryRequired: boolean;
  query: { data: ListEntry[] | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  /** True while a save is under way. */
  busy: boolean;
  /** An error message for the draft, or null when it is valid. */
  validate: (draft: ListDraft) => string | null;
  create: (draft: ListDraft) => Promise<unknown>;
  update: (id: string, changes: Partial<ListDraft> & { archived?: boolean }) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  merge: (id: string, targetId: string) => Promise<unknown>;
}

const aliasesToText = (aliases: readonly string[]) => aliases.join('\n');
const textToAliases = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

function EntryForm({
  texts,
  categoryRequired,
  categories,
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  texts: ListTexts;
  categoryRequired: boolean;
  categories: readonly Category[];
  initial: ListDraft;
  busy: boolean;
  submitLabel: string;
  /** Resolves true when it was saved, so the form can reset or close. */
  onSubmit: (draft: ListDraft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '');
  const [aliases, setAliases] = useState(aliasesToText(initial.aliases));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await onSubmit({
      name: name.trim(),
      categoryId: categoryId || null,
      aliases: textToAliases(aliases),
    });
    if (!saved) return;
    if (onCancel) {
      onCancel();
    } else {
      setName('');
      setCategoryId('');
      setAliases('');
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
      <Field label={texts.name}>
        <TextInput
          value={name}
          maxLength={TEXT_LIMITS.name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label={texts.category}>
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">{categoryRequired ? '' : texts.noCategory}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {optionLabel(category)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={texts.aliases} hint={texts.aliasesHint}>
        <TextArea rows={3} value={aliases} onChange={(event) => setAliases(event.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? es.common.saving : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="quiet" onClick={onCancel}>
            {es.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function EntryRow({
  entry,
  detail,
  busy,
  onEdit,
  onToggleArchived,
  onMerge,
  onDelete,
}: {
  entry: ListEntry;
  detail: string;
  busy: boolean;
  onEdit: () => void;
  onToggleArchived: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 pl-3 pr-2">
      <span className="min-w-0">
        <span className={`block break-words font-medium ${entry.archived ? 'text-muted' : ''}`}>
          {entry.name}
          {entry.archived ? ` (${es.common.archived})` : ''}
        </span>
        <span className="block truncate text-sm text-muted">{detail}</span>
      </span>
      <span className="flex shrink-0 flex-wrap gap-1">
        <Button variant="quiet" onClick={onEdit}>
          {es.common.edit}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onToggleArchived}>
          {entry.archived ? es.common.unarchive : es.common.archive}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onMerge}>
          {es.lists.merge}
        </Button>
        <Button variant="quietDanger" disabled={busy} onClick={onDelete}>
          {es.common.delete}
        </Button>
      </span>
    </li>
  );
}

/** Chooses the item an entry is merged into, after asking. */
function MergePanel({
  texts,
  entry,
  others,
  busy,
  onMerge,
}: {
  texts: ListTexts;
  entry: ListEntry;
  others: readonly ListEntry[];
  busy: boolean;
  onMerge: (targetId: string) => void;
}) {
  const [targetId, setTargetId] = useState('');
  const target = others.find((candidate) => candidate.id === targetId);
  return (
    <li className="space-y-2 bg-canvas p-3">
      <p className="text-sm text-muted">{texts.mergeText}</p>
      <Select
        aria-label={es.lists.merge}
        value={targetId}
        onChange={(event) => setTargetId(event.target.value)}
      >
        <option value="" />
        {others.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </Select>
      <Button
        variant="secondary"
        disabled={busy || !target}
        onClick={() => {
          if (target && window.confirm(texts.mergeConfirm(entry.name, target.name))) onMerge(target.id);
        }}
      >
        {es.lists.merge}
      </Button>
    </li>
  );
}

/** What a row can be doing besides showing itself. */
type RowMode = 'view' | 'edit' | 'merge';

/** One entry: its row, and the form or the merge panel when the user opens one. */
function EntryItem({
  texts,
  categoryRequired,
  entry,
  others,
  categories,
  detail,
  busy,
  save,
  actions,
}: {
  texts: ListTexts;
  categoryRequired: boolean;
  entry: ListEntry;
  others: readonly ListEntry[];
  categories: readonly Category[];
  detail: string;
  busy: boolean;
  /** Validates a draft and runs the action; resolves true when it was saved. */
  save: (action: (draft: ListDraft) => Promise<unknown>) => (draft: ListDraft) => Promise<boolean>;
  actions: Pick<ListPageProps, 'update' | 'remove' | 'merge'> & {
    run: (work: () => Promise<unknown>) => void;
  };
}) {
  const [mode, setMode] = useState<RowMode>('view');
  const toggle = (next: RowMode) => setMode(mode === next ? 'view' : next);

  if (mode === 'edit') {
    return (
      <li className="p-3">
        <EntryForm
          texts={texts}
          categoryRequired={categoryRequired}
          categories={categories}
          initial={entry}
          busy={busy}
          submitLabel={es.common.save}
          onSubmit={save((draft) => actions.update(entry.id, draft))}
          onCancel={() => setMode('view')}
        />
      </li>
    );
  }
  return (
    <>
      <EntryRow
        entry={entry}
        detail={detail}
        busy={busy}
        onEdit={() => toggle('edit')}
        onToggleArchived={() => actions.run(() => actions.update(entry.id, { archived: !entry.archived }))}
        onMerge={() => toggle('merge')}
        onDelete={() => {
          if (window.confirm(texts.deleteConfirm(entry.name))) actions.run(() => actions.remove(entry.id));
        }}
      />
      {mode === 'merge' ? (
        <MergePanel
          texts={texts}
          entry={entry}
          others={others}
          busy={busy}
          onMerge={(targetId) => {
            setMode('view');
            actions.run(() => actions.merge(entry.id, targetId));
          }}
        />
      ) : null}
    </>
  );
}

/** A merchants or products list: rows to edit, archive, merge or delete, and a form to add one. */
export function ListPage({
  texts,
  categoryRequired,
  query,
  busy,
  validate,
  create,
  ...actions
}: ListPageProps) {
  const categories = useCategories();
  const { failure, setFailure, run } = useAction();

  const expenseCategories = orderedTree(categories.data ?? [], 'expense').filter(
    (category) => !category.archived,
  );
  const categoryName = (id: string | null) =>
    (categories.data ?? []).find((category) => category.id === id)?.name ?? texts.noCategory;

  const save = (action: (draft: ListDraft) => Promise<unknown>) => async (draft: ListDraft) => {
    const problem = validate(draft);
    if (problem) {
      setFailure(problem);
      return false;
    }
    return run(() => action(draft));
  };

  return (
    <>
      <PageTitle>{texts.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{texts.text}</p>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={query}>
        {(entries) =>
          entries.length === 0 ? (
            <div className="mb-6">
              <Notice>{texts.empty}</Notice>
            </div>
          ) : (
            <ul className="mb-6 divide-y divide-line rounded-2xl bg-surface shadow-card">
              {entries.map((entry) => (
                <EntryItem
                  key={entry.id}
                  texts={texts}
                  categoryRequired={categoryRequired}
                  entry={entry}
                  others={entries.filter((other) => other.id !== entry.id)}
                  categories={expenseCategories}
                  detail={[categoryName(entry.categoryId), ...entry.aliases].join(' · ')}
                  busy={busy}
                  save={save}
                  actions={{ ...actions, run: (work) => void run(work) }}
                />
              ))}
            </ul>
          )
        }
      </QueryState>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{texts.newTitle}</h2>
        <EntryForm
          texts={texts}
          categoryRequired={categoryRequired}
          categories={expenseCategories}
          initial={{ name: '', categoryId: null, aliases: [] }}
          busy={busy}
          submitLabel={es.common.add}
          onSubmit={save(create)}
        />
      </Card>
    </>
  );
}
