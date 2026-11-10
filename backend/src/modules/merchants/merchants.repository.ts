import type { Merchant } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { MerchantModel, type MerchantDoc } from './merchants.model';

function toMerchant(doc: MerchantDoc): Merchant {
  return {
    id: doc._id.toString(),
    name: doc.name,
    defaultCategoryId: idString(doc.defaultCategoryId),
    aliases: doc.aliases,
    archived: doc.archived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const merchantsPort = createCollectionPort(MerchantModel, [
  { field: 'defaultCategoryId', to: COLLECTIONS.categories },
]);

/** What is written when a merchant is created or changed. The keys are derived by the service. */
export interface MerchantWrite {
  name: string;
  nameKey: string;
  defaultCategoryId: string | null;
  aliases: string[];
  aliasKeys: string[];
  archived: boolean;
}

export const merchantsRepository = {
  async findAll(options: WriteOptions = {}): Promise<Merchant[]> {
    const docs = await MerchantModel.find()
      .sort({ nameKey: 1 })
      .session(options.session ?? null)
      .lean<MerchantDoc[]>();
    return docs.map(toMerchant);
  },

  async create(data: Omit<MerchantWrite, 'archived'>, options: WriteOptions = {}): Promise<Merchant> {
    const [doc] = await MerchantModel.create(
      [{ ...data, defaultCategoryId: toObjectIdOrNull(data.defaultCategoryId) }],
      { session: options.session },
    );
    return toMerchant(doc!.toObject() as MerchantDoc);
  },

  /** Replaces everything the user can change; the service sends the whole merchant. */
  async update(id: string, data: MerchantWrite, options: WriteOptions = {}): Promise<Merchant | null> {
    const doc = await MerchantModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: { ...data, defaultCategoryId: toObjectIdOrNull(data.defaultCategoryId) } },
      { new: true, session: options.session },
    ).lean<MerchantDoc>();
    return doc ? toMerchant(doc) : null;
  },

  /** A category merged into another: the merchants that suggested it now suggest the other. */
  async moveCategory(fromId: string, toId: string, options: WriteOptions = {}): Promise<void> {
    await MerchantModel.updateMany(
      { defaultCategoryId: toObjectId(fromId) },
      { $set: { defaultCategoryId: toObjectId(toId) } },
      { session: options.session },
    );
  },

  /** A category deleted: its merchants stay, without a suggested one. */
  async clearCategory(categoryId: string, options: WriteOptions = {}): Promise<void> {
    await MerchantModel.updateMany(
      { defaultCategoryId: toObjectId(categoryId) },
      { $set: { defaultCategoryId: null } },
      { session: options.session },
    );
  },
};

export type MerchantsRepository = typeof merchantsRepository;
