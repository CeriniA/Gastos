import type { Category, CategoryKind, CategoryRole } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { CategoryModel, type CategoryDoc } from './categories.model';

/** A category as stored. `depth` is derived by the service. */
export type CategoryRow = Omit<Category, 'depth'>;

function toRow(doc: CategoryDoc): CategoryRow {
  return {
    id: doc._id.toString(),
    name: doc.name,
    kind: doc.kind,
    parentId: idString(doc.parentId),
    role: doc.role ?? null,
    archived: doc.archived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const categoriesPort = createCollectionPort(CategoryModel, [
  { field: 'parentId', to: COLLECTIONS.categories },
]);

export const categoriesRepository = {
  async findAll(options: WriteOptions = {}): Promise<CategoryRow[]> {
    const docs = await CategoryModel.find()
      .sort({ kind: 1, nameKey: 1 })
      .session(options.session ?? null)
      .lean<CategoryDoc[]>();
    return docs.map(toRow);
  },

  async create(
    data: {
      name: string;
      nameKey: string;
      kind: CategoryKind;
      parentId: string | null;
      role?: CategoryRole | null;
    },
    options: WriteOptions = {},
  ): Promise<CategoryRow> {
    const [doc] = await CategoryModel.create([{ ...data, parentId: toObjectIdOrNull(data.parentId) }], {
      session: options.session,
    });
    return toRow(doc!.toObject() as CategoryDoc);
  },

  async update(
    id: string,
    changes: Partial<{ name: string; nameKey: string; parentId: string | null; archived: boolean }>,
  ): Promise<CategoryRow | null> {
    const { parentId, ...rest } = changes;
    const set = parentId === undefined ? rest : { ...rest, parentId: toObjectIdOrNull(parentId) };
    const doc = await CategoryModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: set },
      { new: true },
    ).lean<CategoryDoc>();
    return doc ? toRow(doc) : null;
  },

  async delete(id: string, options: WriteOptions = {}): Promise<void> {
    await CategoryModel.deleteOne({ _id: toObjectId(id) }, { session: options.session });
  },
};

export type CategoriesRepository = typeof categoriesRepository;
