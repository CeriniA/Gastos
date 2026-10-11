import type { FilterQuery } from 'mongoose';
import {
  firstDayOfMonth,
  lastDayOfMonth,
  type CurrencyTotals,
  type Paginated,
  type Transaction,
  type TransactionListQuery,
} from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, isoString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { duplicateKey } from './duplicateKey';
import { TransactionModel, type TransactionDoc } from './transactions.model';

/** Everything the service decides about a transaction before it is stored. */
export type TransactionRecord = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type TransactionFilter = Omit<TransactionListQuery, 'categoryId'> & {
  /** A category together with its descendants. */
  categoryIds?: string[];
};

function toTransaction(doc: TransactionDoc): Transaction {
  return {
    id: doc._id.toString(),
    type: doc.type,
    status: doc.status,
    source: doc.source,
    date: doc.date,
    paymentDate: doc.paymentDate,
    amountCents: doc.amountCents,
    currency: doc.currency,
    accountId: doc.accountId.toString(),
    toAccountId: idString(doc.toAccountId),
    toAmountCents: doc.toAmountCents ?? null,
    categoryId: idString(doc.categoryId),
    description: doc.description ?? '',
    note: doc.note ?? '',
    tagIds: (doc.tagIds ?? []).map((id) => id.toString()),
    splits: (doc.splits ?? []).map((split) => ({
      categoryId: split.categoryId.toString(),
      amountCents: split.amountCents,
    })),
    items: (doc.items ?? []).map((item) => ({ name: item.name, amountCents: item.amountCents })),
    installment: doc.installment
      ? {
          planId: idString(doc.installment.planId),
          number: doc.installment.number,
          total: doc.installment.total,
        }
      : null,
    documentId: idString(doc.documentId),
    cardPeriodId: idString(doc.cardPeriodId),
    recurringId: idString(doc.recurringId),
    edited: doc.edited,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: isoString(doc.deletedAt),
  };
}

function toStored(record: TransactionRecord) {
  return {
    ...record,
    accountId: toObjectId(record.accountId),
    toAccountId: toObjectIdOrNull(record.toAccountId),
    categoryId: toObjectIdOrNull(record.categoryId),
    tagIds: record.tagIds.map(toObjectId),
    splits: record.splits.map((split) => ({
      categoryId: toObjectId(split.categoryId),
      amountCents: split.amountCents,
    })),
    installment: record.installment
      ? { ...record.installment, planId: toObjectIdOrNull(record.installment.planId) }
      : null,
    documentId: toObjectIdOrNull(record.documentId),
    cardPeriodId: toObjectIdOrNull(record.cardPeriodId),
    recurringId: toObjectIdOrNull(record.recurringId),
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter(query: Partial<TransactionFilter>): FilterQuery<TransactionDoc> {
  const and: FilterQuery<TransactionDoc>[] = [{ deletedAt: query.deleted ? { $ne: null } : null }];
  if (query.month) {
    and.push({ paymentDate: { $gte: firstDayOfMonth(query.month), $lte: lastDayOfMonth(query.month) } });
  }
  if (query.from) and.push({ date: { $gte: query.from } });
  if (query.to) and.push({ date: { $lte: query.to } });
  if (query.type) and.push({ type: query.type });
  if (query.source) and.push({ source: query.source });
  if (query.tagId) and.push({ tagIds: toObjectId(query.tagId) });
  if (query.accountId) {
    const id = toObjectId(query.accountId);
    and.push({ $or: [{ accountId: id }, { toAccountId: id }] });
  }
  if (query.categoryIds && query.categoryIds.length > 0) {
    const ids = query.categoryIds.map(toObjectId);
    and.push({ $or: [{ categoryId: { $in: ids } }, { 'splits.categoryId': { $in: ids } }] });
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    and.push({ $or: [{ description: pattern }, { note: pattern }] });
  }
  return { $and: and };
}

export const transactionsPort = createCollectionPort(TransactionModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
  { field: 'toAccountId', to: COLLECTIONS.accounts },
  { field: 'categoryId', to: COLLECTIONS.categories },
  { field: 'splits.categoryId', to: COLLECTIONS.categories, unwind: 'splits' },
  { field: 'tagIds', to: COLLECTIONS.tags, unwind: 'tagIds' },
  { field: 'documentId', to: COLLECTIONS.documents },
  { field: 'installment.planId', to: COLLECTIONS.installmentPlans },
  { field: 'cardPeriodId', to: COLLECTIONS.cardPeriods },
  { field: 'recurringId', to: COLLECTIONS.recurrings },
]);

export const transactionsRepository = {
  async find(query: TransactionFilter): Promise<Paginated<Transaction>> {
    const filter = buildFilter(query);
    const [docs, total] = await Promise.all([
      TransactionModel.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean<TransactionDoc[]>(),
      TransactionModel.countDocuments(filter),
    ]);
    return { items: docs.map(toTransaction), page: query.page, pageSize: query.pageSize, total };
  },

  /** Every live transaction in a date range, oldest first. For exports. */
  async findAllForExport(range: { from?: string; to?: string }): Promise<Transaction[]> {
    const docs = await TransactionModel.find(buildFilter(range))
      .sort({ date: 1, createdAt: 1 })
      .lean<TransactionDoc[]>();
    return docs.map(toTransaction);
  },

  async findById(id: string): Promise<Transaction | null> {
    const doc = await TransactionModel.findById(toObjectId(id)).lean<TransactionDoc>();
    return doc ? toTransaction(doc) : null;
  },

  async insertMany(
    records: readonly TransactionRecord[],
    options: WriteOptions = {},
  ): Promise<Transaction[]> {
    const docs = await TransactionModel.create(records.map(toStored), {
      session: options.session,
      ordered: true,
    });
    return docs.map((doc) => toTransaction(doc.toObject() as TransactionDoc));
  },

  async replace(id: string, record: TransactionRecord): Promise<Transaction | null> {
    const doc = await TransactionModel.findOneAndUpdate(
      { _id: toObjectId(id), deletedAt: null },
      { $set: toStored(record) },
      { new: true, runValidators: true },
    ).lean<TransactionDoc>();
    return doc ? toTransaction(doc) : null;
  },

  async setDeleted(id: string, deletedAt: Date | null): Promise<boolean> {
    const result = await TransactionModel.updateOne(
      { _id: toObjectId(id), deletedAt: deletedAt ? null : { $ne: null } },
      { $set: { deletedAt } },
    );
    return result.modifiedCount === 1;
  },

  async purgeDeletedBefore(cutoff: Date): Promise<number> {
    const result = await TransactionModel.deleteMany({ deletedAt: { $ne: null, $lt: cutoff } });
    return result.deletedCount;
  },

  countByAccount(accountId: string): Promise<number> {
    const id = toObjectId(accountId);
    return TransactionModel.countDocuments({ $or: [{ accountId: id }, { toAccountId: id }] });
  },

  countByCategory(categoryId: string): Promise<number> {
    const id = toObjectId(categoryId);
    return TransactionModel.countDocuments({ $or: [{ categoryId: id }, { 'splits.categoryId': id }] });
  },

  async moveCategory(fromId: string, toId: string, options: WriteOptions = {}): Promise<void> {
    const from = toObjectId(fromId);
    const to = toObjectId(toId);
    await TransactionModel.updateMany(
      { categoryId: from },
      { $set: { categoryId: to } },
      { session: options.session },
    );
    await TransactionModel.updateMany(
      { 'splits.categoryId': from },
      { $set: { 'splits.$[split].categoryId': to } },
      { arrayFilters: [{ 'split.categoryId': from }], session: options.session },
    );
  },

  async pullTag(tagId: string, options: WriteOptions = {}): Promise<void> {
    const id = toObjectId(tagId);
    await TransactionModel.updateMany(
      { tagIds: id },
      { $pull: { tagIds: id } },
      { session: options.session },
    );
  },

  /** Income and expense per currency for the transactions paid in a month. */
  async totalsByMonth(month: string): Promise<CurrencyTotals[]> {
    const rows = await TransactionModel.aggregate<{
      _id: { currency: CurrencyTotals['currency']; type: string };
      total: number;
    }>([
      {
        $match: {
          deletedAt: null,
          status: 'confirmed',
          type: { $in: ['income', 'expense'] },
          paymentDate: { $gte: firstDayOfMonth(month), $lte: lastDayOfMonth(month) },
        },
      },
      { $group: { _id: { currency: '$currency', type: '$type' }, total: { $sum: '$amountCents' } } },
    ]);
    const totals = new Map<string, CurrencyTotals>();
    for (const row of rows) {
      const entry = totals.get(row._id.currency) ?? {
        currency: row._id.currency,
        incomeCents: 0,
        expenseCents: 0,
        balanceCents: 0,
      };
      if (row._id.type === 'income') entry.incomeCents = row.total;
      else entry.expenseCents = row.total;
      entry.balanceCents = entry.incomeCents - entry.expenseCents;
      totals.set(row._id.currency, entry);
    }
    return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  },

  /**
   * Keys ("date|amountCents|accountId") of live transactions that fall inside
   * the given date range and accounts. The import uses them to flag duplicates.
   */
  async duplicateKeys(range: {
    from: string;
    to: string;
    accountIds: readonly string[];
  }): Promise<Set<string>> {
    if (range.accountIds.length === 0) return new Set();
    const docs = await TransactionModel.find(
      {
        deletedAt: null,
        date: { $gte: range.from, $lte: range.to },
        accountId: { $in: range.accountIds.map(toObjectId) },
      },
      { date: 1, amountCents: 1, accountId: 1 },
    ).lean<Pick<TransactionDoc, 'date' | 'amountCents' | 'accountId'>[]>();
    return new Set(docs.map((doc) => duplicateKey(doc.date, doc.amountCents, doc.accountId.toString())));
  },
};

export type TransactionsRepository = typeof transactionsRepository;
