import type { Product } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { ProductModel, type ProductDoc } from './products.model';

function toProduct(doc: ProductDoc): Product {
  return {
    id: doc._id.toString(),
    name: doc.name,
    categoryId: doc.categoryId.toString(),
    aliases: doc.aliases,
    archived: doc.archived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const productsPort = createCollectionPort(ProductModel, [
  { field: 'categoryId', to: COLLECTIONS.categories },
]);

/** What is written when a product is created or changed. The keys are derived by the service. */
export interface ProductWrite {
  name: string;
  nameKey: string;
  categoryId: string;
  aliases: string[];
  aliasKeys: string[];
  archived: boolean;
}

export const productsRepository = {
  async findAll(options: WriteOptions = {}): Promise<Product[]> {
    const docs = await ProductModel.find()
      .sort({ nameKey: 1 })
      .session(options.session ?? null)
      .lean<ProductDoc[]>();
    return docs.map(toProduct);
  },

  async create(data: Omit<ProductWrite, 'archived'>, options: WriteOptions = {}): Promise<Product> {
    const [doc] = await ProductModel.create([{ ...data, categoryId: toObjectId(data.categoryId) }], {
      session: options.session,
    });
    return toProduct(doc!.toObject() as ProductDoc);
  },

  /** Replaces everything the user can change; the service sends the whole product. */
  async update(id: string, data: ProductWrite, options: WriteOptions = {}): Promise<Product | null> {
    const doc = await ProductModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: { ...data, categoryId: toObjectId(data.categoryId) } },
      { new: true, session: options.session },
    ).lean<ProductDoc>();
    return doc ? toProduct(doc) : null;
  },

  async countByCategory(categoryId: string): Promise<number> {
    return ProductModel.countDocuments({ categoryId: toObjectId(categoryId) });
  },

  /** A category merged into another: its products follow it. */
  async moveCategory(fromId: string, toId: string, options: WriteOptions = {}): Promise<void> {
    await ProductModel.updateMany(
      { categoryId: toObjectId(fromId) },
      { $set: { categoryId: toObjectId(toId) } },
      { session: options.session },
    );
  },
};

export type ProductsRepository = typeof productsRepository;
