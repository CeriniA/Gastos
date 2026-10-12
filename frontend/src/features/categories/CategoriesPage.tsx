import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import {
  CATEGORY_KINDS,
  MAX_CATEGORY_DEPTH,
  categoryCreateSchema,
  categoryUpdateSchema,
  moveProblem,
  type Category,
  type CategoryKind,
  type CategoryUpdate,
  TEXT_LIMITS,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { useAction } from '../../shared/ui/useAction';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, Tabs, TextInput } from '../../shared/ui/ui';
import { useCategories, useCategoryMutations } from './api';
import { optionLabel, orderedTree } from './tree';

interface FormValues {
  name: string;
  parentId: string;
}

/**
 * Everything that can be done to one category: rename it, move it under
 * another, merge it into another, archive it or delete it.
 */
function CategoryEditor({
  category,
  siblingsOfKind,
  all,
  busy,
  onSave,
  onMerge,
  onArchive,
  onDelete,
  onClose,
}: {
  category: Category;
  /** Categories of the same kind, in display order. */
  siblingsOfKind: readonly Category[];
  all: readonly Category[];
  busy: boolean;
  onSave: (changes: CategoryUpdate) => Promise<boolean>;
  onMerge: (targetId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [parentId, setParentId] = useState(category.parentId ?? '');
  const [targetId, setTargetId] = useState('');

  const others = siblingsOfKind.filter((candidate) => candidate.id !== category.id);
  // Only the places where the whole branch still fits within the three levels.
  const parents = others.filter(
    (candidate) =>
      (!candidate.archived || candidate.id === category.parentId) &&
      moveProblem(category.id, candidate.id, all) === null,
  );
  const hasChildren = all.some((candidate) => candidate.parentId === category.id);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const changes: CategoryUpdate = {};
    if (name.trim() !== category.name) changes.name = name;
    if ((parentId || null) !== category.parentId) changes.parentId = parentId || null;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    const parsed = categoryUpdateSchema.safeParse(changes);
    if (parsed.success && (await onSave(parsed.data))) onClose();
  };

  return (
    <div className="space-y-4 border-t border-line bg-paper p-3">
      <form onSubmit={(event) => void save(event)} className="space-y-3" noValidate>
        <Field label={es.categories.name}>
          <TextInput
            value={name}
            maxLength={TEXT_LIMITS.name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={es.categories.parent} hint={es.categories.moveHint}>
          <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">{es.categories.rootOption}</option>
            {parents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {optionLabel(candidate)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy || !name.trim()}>
            {es.common.save}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {es.common.cancel}
          </Button>
        </div>
      </form>

      <div className="space-y-2 border-t border-line pt-3">
        <p className="text-sm font-medium text-muted">{es.categories.mergeTitle}</p>
        {hasChildren ? (
          <p className="text-sm text-muted">{es.categories.mergeBlocked}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{es.categories.mergeText}</p>
            <div className="flex gap-2">
              <Select
                aria-label={es.categories.mergeTitle}
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="" />
                {others.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {optionLabel(candidate)}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                disabled={busy || !targetId}
                onClick={() => {
                  const target = others.find((candidate) => candidate.id === targetId);
                  if (target && window.confirm(es.categories.mergeConfirm(category.name, target.name))) {
                    onMerge(target.id);
                  }
                }}
              >
                {es.categories.mergeAction}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 border-t border-line pt-3">
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={onArchive}>
          {category.archived ? es.common.unarchive : es.common.archive}
        </Button>
        <Button variant="danger" className="flex-1" disabled={busy} onClick={onDelete}>
          {es.common.delete}
        </Button>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const categories = useCategories();
  const { create, update, remove, merge } = useCategoryMutations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const busy = create.isPending || update.isPending || remove.isPending || merge.isPending;
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { failure, run } = useAction();
  const form = useForm<FormValues>({ defaultValues: { name: '', parentId: '' } });

  const submit = form.handleSubmit(async (values) => {
    const parsed = categoryCreateSchema.safeParse({
      name: values.name,
      kind,
      parentId: values.parentId || null,
    });
    if (!parsed.success) {
      form.setError('name', { message: es.fieldMessages.required });
      return;
    }
    await run(create.mutateAsync(parsed.data).then(() => form.reset()));
  });

  return (
    <>
      <PageTitle>{es.categories.title}</PageTitle>

      <Tabs
        options={CATEGORY_KINDS}
        value={kind}
        label={(option) => es.kinds[option]}
        onChange={(option) => {
          setKind(option);
          setEditingId(null);
          form.reset();
        }}
      />

      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <QueryState query={categories}>
        {(all) => {
          const tree = orderedTree(all, kind);
          const parents = tree.filter(
            (category) => category.depth < MAX_CATEGORY_DEPTH && !category.archived,
          );
          return (
            <>
              {tree.length === 0 ? (
                <div className="mb-6">
                  <Notice>{es.categories.empty}</Notice>
                </div>
              ) : (
                <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
                  {tree.map((category) => (
                    <li key={category.id}>
                      <div
                        className="flex items-center justify-between gap-3 py-2 pr-2"
                        style={{ paddingLeft: `${0.75 + (category.depth - 1) * 1.25}rem` }}
                      >
                        <span
                          className={`min-w-0 break-words ${
                            category.archived
                              ? 'text-muted line-through'
                              : category.depth === 1
                                ? 'font-semibold'
                                : ''
                          }`}
                        >
                          {category.name}
                        </span>
                        <Button
                          variant="quiet"
                          className="shrink-0"
                          aria-expanded={editingId === category.id}
                          onClick={() => setEditingId(editingId === category.id ? null : category.id)}
                        >
                          {editingId === category.id ? es.common.close : es.common.edit}
                        </Button>
                      </div>
                      {editingId === category.id ? (
                        <CategoryEditor
                          key={category.id}
                          category={category}
                          siblingsOfKind={tree}
                          all={all}
                          busy={busy}
                          onClose={() => setEditingId(null)}
                          onSave={(changes) => run(update.mutateAsync({ id: category.id, changes }))}
                          onMerge={(targetId) =>
                            void run(merge.mutateAsync({ id: category.id, targetId })).then(
                              (done) => done && setEditingId(null),
                            )
                          }
                          onArchive={() =>
                            void run(
                              update.mutateAsync({
                                id: category.id,
                                changes: { archived: !category.archived },
                              }),
                            )
                          }
                          onDelete={() => {
                            if (window.confirm(es.categories.deleteConfirm(category.name))) {
                              void run(remove.mutateAsync(category.id));
                            }
                          }}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <Card>
                <h2 className="mb-3 text-lg font-semibold">{es.categories.newTitle}</h2>
                <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
                  <Field label={es.categories.name} error={form.formState.errors.name?.message}>
                    <TextInput {...form.register('name')} />
                  </Field>
                  <Field label={es.categories.parent} hint={es.categories.depthHint}>
                    <Select {...form.register('parentId')}>
                      <option value="">{es.categories.rootOption}</option>
                      {parents.map((category) => (
                        <option key={category.id} value={category.id}>
                          {optionLabel(category)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? es.common.saving : es.common.add}
                  </Button>
                </form>
              </Card>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
