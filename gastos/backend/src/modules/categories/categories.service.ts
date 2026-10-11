import {
  MAX_CATEGORY_DEPTH,
  depthOf,
  moveProblem,
  nameKey,
  type Category,
  type CategoryCreate,
  type CategoryKind,
  type CategoryUpdate,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import {
  ConflictError,
  DuplicateError,
  InUseError,
  NotFoundError,
  fieldError,
} from '../../core/errors/errors';
import type { CategoriesRepository, CategoryRow } from './categories.repository';

export interface CategoryUsage {
  /** Transactions (including the trash) that use the category directly or in a split. */
  countTransactions(categoryId: string): Promise<number>;
  moveTransactions(fromCategoryId: string, toCategoryId: string, options: WriteOptions): Promise<void>;
}

function withDepth(rows: readonly CategoryRow[]): Category[] {
  return rows.map((row) => ({ ...row, depth: depthOf(row.id, rows) }));
}

export function createCategoriesService(
  repository: CategoriesRepository,
  usage: CategoryUsage,
  runInTransaction: TransactionRunner,
) {
  async function list(options: WriteOptions = {}): Promise<Category[]> {
    return withDepth(await repository.findAll(options));
  }

  function find(categories: readonly Category[], id: string): Category {
    const category = categories.find((candidate) => candidate.id === id);
    if (!category) throw new NotFoundError('Category', id);
    return category;
  }

  function assertSiblingNameFree(
    categories: readonly Category[],
    target: { name: string; kind: CategoryKind; parentId: string | null },
    exceptId?: string,
  ): void {
    const clash = categories.some(
      (candidate) =>
        candidate.id !== exceptId &&
        candidate.kind === target.kind &&
        candidate.parentId === target.parentId &&
        nameKey(candidate.name) === nameKey(target.name),
    );
    if (clash) throw new DuplicateError('Category', 'name');
  }

  function assertValidParent(
    categories: readonly Category[],
    kind: CategoryKind,
    parentId: string | null,
  ): void {
    if (parentId === null) return;
    const parent = categories.find((candidate) => candidate.id === parentId);
    if (!parent) throw fieldError('parentId', 'Parent category does not exist');
    if (parent.kind !== kind) throw fieldError('parentId', 'Parent category is of a different kind');
    if (parent.depth >= MAX_CATEGORY_DEPTH) {
      throw fieldError('parentId', `Categories can be nested up to ${MAX_CATEGORY_DEPTH} levels`);
    }
  }

  async function create(input: CategoryCreate, options: WriteOptions = {}): Promise<Category> {
    const categories = await list(options);
    assertValidParent(categories, input.kind, input.parentId);
    assertSiblingNameFree(categories, input);
    const row = await repository.create({ ...input, nameKey: nameKey(input.name) }, options);
    const parentDepth = input.parentId ? find(categories, input.parentId).depth : 0;
    return { ...row, depth: parentDepth + 1 };
  }

  return {
    list,
    create,

    async get(id: string): Promise<Category> {
      return find(await list(), id);
    },

    async update(id: string, input: CategoryUpdate): Promise<Category> {
      const categories = await list();
      const current = find(categories, id);
      const next = {
        name: input.name ?? current.name,
        kind: current.kind,
        parentId: input.parentId === undefined ? current.parentId : input.parentId,
      };

      if (next.parentId !== current.parentId) {
        assertValidParent(categories, current.kind, next.parentId);
        const problem = moveProblem(id, next.parentId, categories);
        if (problem === 'self' || problem === 'cycle') {
          throw fieldError('parentId', 'A category cannot be moved inside itself');
        }
        if (problem === 'too_deep') {
          throw fieldError('parentId', `Categories can be nested up to ${MAX_CATEGORY_DEPTH} levels`);
        }
      }
      assertSiblingNameFree(categories, next, id);

      await repository.update(id, {
        ...(input.name !== undefined ? { name: input.name, nameKey: nameKey(input.name) } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      });
      return find(await list(), id);
    },

    /** Only an unused leaf can be deleted. Otherwise archive it or merge it. */
    async remove(id: string): Promise<void> {
      const categories = await list();
      find(categories, id);
      const children = categories.filter((candidate) => candidate.parentId === id).length;
      if (children > 0) throw new InUseError('Category', 'subcategories', children);
      const transactions = await usage.countTransactions(id);
      if (transactions > 0) throw new InUseError('Category', 'transactions', transactions);
      await repository.delete(id);
    },

    /** Moves every transaction of `sourceId` to `targetId`, then deletes the source. */
    async merge(sourceId: string, targetId: string): Promise<Category> {
      const categories = await list();
      const source = find(categories, sourceId);
      const target = find(categories, targetId);
      if (source.id === target.id) throw fieldError('targetId', 'Choose a different category to merge into');
      if (source.kind !== target.kind)
        throw fieldError('targetId', 'Both categories must be of the same kind');
      if (categories.some((candidate) => candidate.parentId === source.id)) {
        throw new ConflictError('Move or merge the subcategories first', { entity: 'Category' });
      }
      await runInTransaction(async (session) => {
        await usage.moveTransactions(source.id, target.id, { session });
        await repository.delete(source.id, { session });
      });
      return target;
    },

    /**
     * Returns the category at the end of a path of names, creating the missing
     * levels. Used by the spreadsheet import.
     */
    async ensurePath(
      kind: CategoryKind,
      path: readonly string[],
      options: WriteOptions,
    ): Promise<{ category: Category; created: number }> {
      let categories = await list(options);
      let parentId: string | null = null;
      let current: Category | undefined;
      let created = 0;
      for (const name of path) {
        current = categories.find(
          (candidate) =>
            candidate.kind === kind &&
            candidate.parentId === parentId &&
            nameKey(candidate.name) === nameKey(name),
        );
        if (!current) {
          current = await create({ name: name.trim(), kind, parentId }, options);
          categories = [...categories, current];
          created += 1;
        }
        parentId = current.id;
      }
      if (!current) throw fieldError('category', 'Empty category path');
      return { category: current, created };
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
