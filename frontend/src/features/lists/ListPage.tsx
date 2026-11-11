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
        <TextInput value={name} maxLength={TEXT_LIMITS.name} onChange={(event) => setName(event.target.value)} />
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
}: {
  entry: ListEntry;
  detail: string;
  busy: boolean;
  onEdit: () => void;
  onToggleArchived: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 pl-3 pr-2">
      <span className="min-w-0">
        <span className={`block break-words font-medium ${entry.archived ? 'text-muted' : ''}`}>
          {entry.name}
          {entry.archived ? ` (${es.common.archived})` : ''}
        </span>
        <span className="block truncate text-sm text-muted">{detail}</span>
      </span>
      <span className="flex shrink-0 gap-1">
        <Button variant="quiet" onClick={onEdit}>
          {es.common.edit}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onToggleArchived}>
          {entry.archived ? es.common.unarchive : es.common.archive}
        </Button>
      </span>
    </li>
  );
}

/** A merchants or products list: rows to edit or archive, and a form to add one. */
export function ListPage({ texts, categoryRequired, query, busy, validate, create, update }: ListPageProps) {
  const categories = useCategories();
  const { failure, setFailure, run } = useAction();
  const [editingId, setEditingId] = useState<string | null>(null);

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
              {entries.map((entry) =>
                editingId === entry.id ? (
                  <li key={entry.id} className="p-3">
                    <EntryForm
                      texts={texts}
                      categoryRequired={categoryRequired}
                      categories={expenseCategories}
                      initial={entry}
                      busy={busy}
                      submitLabel={es.common.save}
                      onSubmit={save((draft) => update(entry.id, draft))}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    detail={[categoryName(entry.categoryId), ...entry.aliases].join(' · ')}
                    busy={busy}
                    onEdit={() => setEditingId(entry.id)}
                    onToggleArchived={() => void run(() => update(entry.id, { archived: !entry.archived }))}
                  />
                ),
              )}
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
