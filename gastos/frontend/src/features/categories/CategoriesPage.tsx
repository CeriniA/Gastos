import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CATEGORY_KINDS, MAX_CATEGORY_DEPTH, categoryCreateSchema, type CategoryKind } from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useCategories, useCategoryMutations } from './api';
import { optionLabel, orderedTree } from './tree';

interface FormValues {
  name: string;
  parentId: string;
}

export function CategoriesPage() {
  const categories = useCategories();
  const { create, update, remove } = useCategoryMutations();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: { name: '', parentId: '' } });

  const run = async (work: Promise<unknown>) => {
    setFailure(null);
    try {
      await work;
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

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

      <div
        role="tablist"
        className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1"
      >
        {CATEGORY_KINDS.map((option) => (
          <button
            key={option}
            role="tab"
            type="button"
            aria-selected={kind === option}
            onClick={() => {
              setKind(option);
              form.reset();
            }}
            className={`min-h-10 rounded-md text-sm font-semibold ${kind === option ? 'bg-income text-surface' : 'text-muted'}`}
          >
            {es.kinds[option]}
          </button>
        ))}
      </div>

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
                    <li
                      key={category.id}
                      className="flex items-center justify-between gap-3 py-2 pr-2"
                      style={{ paddingLeft: `${0.75 + (category.depth - 1) * 1.25}rem` }}
                    >
                      <span
                        className={
                          category.archived
                            ? 'text-muted line-through'
                            : category.depth === 1
                              ? 'font-semibold'
                              : ''
                        }
                      >
                        {category.name}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button
                          variant="quiet"
                          onClick={() =>
                            void run(
                              update.mutateAsync({
                                id: category.id,
                                changes: { archived: !category.archived },
                              }),
                            )
                          }
                        >
                          {category.archived ? es.common.unarchive : es.common.archive}
                        </Button>
                        <Button
                          variant="quiet"
                          className="text-expense"
                          onClick={() => void run(remove.mutateAsync(category.id))}
                        >
                          {es.common.delete}
                        </Button>
                      </span>
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
