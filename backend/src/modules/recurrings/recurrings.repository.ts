import type { Recurring } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { RecurringModel, type RecurringDoc } from './recurrings.model';

/** Everything the service decides about a fixed item before it is stored. */
export type RecurringRecord = Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> & { nameKey: string };

function toRecurring(doc: RecurringDoc): Recurring {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    expectedAmountCents: doc.expectedAmountCents,
    currency: doc.currency,
    accountId: doc.accountId.toString(),
    categoryId: idString(doc.categoryId),
    dayOfMonth: doc.dayOfMonth,
    active: doc.active,
    ignored: doc.ignored ?? false,
    merchantKey: doc.merchantKey ?? doc.nameKey,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toStored(record: Partial<RecurringRecord>) {
  return {
    ...record,
    ...(record.accountId === undefined ? {} : { accountId: toObjectId(record.accountId) }),
    ...(record.categoryId === undefined ? {} : { categoryId: toObjectIdOrNull(record.categoryId) }),
  };
}

export const recurringsPort = createCollectionPort(RecurringModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
  { field: 'categoryId', to: COLLECTIONS.categories },
]);

export const recurringsRepository = {
  /** By name. */
  async findAll(): Promise<Recurring[]> {
    const docs = await RecurringModel.find().sort({ nameKey: 1 }).lean<RecurringDoc[]>();
    return docs.map(toRecurring);
  },

  async findById(id: string): Promise<Recurring | null> {
    const doc = await RecurringModel.findById(toObjectId(id)).lean<RecurringDoc>();
    return doc ? toRecurring(doc) : null;
  },

  async findByNameKey(nameKey: string): Promise<Recurring | null> {
    const doc = await RecurringModel.findOne({ nameKey }).lean<RecurringDoc>();
    return doc ? toRecurring(doc) : null;
  },

  async create(record: RecurringRecord, options: WriteOptions = {}): Promise<Recurring> {
    const [doc] = await RecurringModel.create([toStored(record)], { session: options.session });
    return toRecurring(doc!.toObject() as RecurringDoc);
  },

  async update(
    id: string,
    changes: Partial<RecurringRecord>,
    options: WriteOptions = {},
  ): Promise<Recurring | null> {
    const doc = await RecurringModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: toStored(changes) },
      { new: true, runValidators: true, session: options.session },
    ).lean<RecurringDoc>();
    return doc ? toRecurring(doc) : null;
  },

  async delete(id: string, options: WriteOptions = {}): Promise<void> {
    await RecurringModel.deleteOne({ _id: toObjectId(id) }, { session: options.session });
  },

  countByAccount(accountId: string): Promise<number> {
    return RecurringModel.countDocuments({ accountId: toObjectId(accountId) });
  },

  /** A category merged into another: its fixed items follow it. */
  async moveCategory(fromId: string, toId: string, options: WriteOptions = {}): Promise<void> {
    await RecurringModel.updateMany(
      { categoryId: toObjectId(fromId) },
      { $set: { categoryId: toObjectId(toId) } },
      { session: options.session },
    );
  },

  /** A category deleted: its fixed items stay, without one. */
  async clearCategory(categoryId: string, options: WriteOptions = {}): Promise<void> {
    await RecurringModel.updateMany(
      { categoryId: toObjectId(categoryId) },
      { $set: { categoryId: null } },
      { session: options.session },
    );
  },
};

export type RecurringsRepository = typeof recurringsRepository;
