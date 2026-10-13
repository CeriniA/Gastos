import type { FilterQuery } from 'mongoose';
import {
  PRODUCT_GROUPS,
  firstDayOfMonth,
  givenBack,
  lastDayOfMonth,
  spendingCents,
  type ConsumptionItem,
  type CurrencyTotals,
  type FiledAmount,
  type LastRate,
  type Paginated,
  type ProductGroup,
  type Split,
  type Transaction,
  type TransactionItem,
  type TransactionListQuery,
} from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, isoString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { duplicateKey, installmentKey } from './duplicateKey';
import { filedAmounts, type Filing } from './splits';
import { TransactionModel, type TransactionDoc } from './transactions.model';

/** Everything the service decides about a transaction before it is stored. */
export type TransactionRecord = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface PaymentDateRow {
  id: string;
  date: string;
  paymentDate: string;
}

export interface ChargeRow {
  date: string;
  paymentDate: string;
  signedCents: number;
}

export type TransactionFilter = Omit<TransactionListQuery, 'categoryId'> & {
  /** A category together with its descendants. */
  categoryIds?: string[];
};

function toTransaction(doc: TransactionDoc): Transaction {
  return {
    id: doc._id.toString(),
    type: doc.type,
    // Stored before refunds existed means it is not one.
    refund: doc.refund ?? false,
    status: doc.status,
    source: doc.source,
    date: doc.date,
    paymentDate: doc.paymentDate,
    amountCents: doc.amountCents,
    currency: doc.currency,
    original: doc.original
      ? { amountCents: doc.original.amountCents, currency: doc.original.currency, rate: doc.original.rate }
      : null,
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
    items: (doc.items ?? []).map(toItem),
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

/** Lines stored before products were classified read as "unknown". */
function toItem(item: TransactionDoc['items'][number]): TransactionItem {
  return {
    name: item.name,
    amountCents: item.amountCents,
    product: item.product ?? '',
    group: (PRODUCT_GROUPS as readonly string[]).includes(item.group ?? '')
      ? (item.group as ProductGroup)
      : null,
    quantity: item.quantity ?? null,
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

  /** Deletes for good a transaction that is in the trash. A live one is left alone. */
  async deleteTrashed(id: string): Promise<boolean> {
    const result = await TransactionModel.deleteOne({ _id: toObjectId(id), deletedAt: { $ne: null } });
    return result.deletedCount === 1;
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

  /**
   * What the live transfers that pay each of those statements add up to, in
   * the card's currency: what reached the card, not what left the other account.
   */
  async sumPaymentsByPeriod(cardPeriodIds: readonly string[]): Promise<Map<string, number>> {
    const paid = new Map<string, number>();
    if (cardPeriodIds.length === 0) return paid;
    const docs = await TransactionModel.find(
      { cardPeriodId: { $in: cardPeriodIds.map(toObjectId) }, deletedAt: null, type: 'transfer' },
      { cardPeriodId: 1, amountCents: 1, toAmountCents: 1 },
    ).lean<Pick<TransactionDoc, 'cardPeriodId' | 'amountCents' | 'toAmountCents'>[]>();
    for (const doc of docs) {
      const period = doc.cardPeriodId!.toString();
      paid.set(period, (paid.get(period) ?? 0) + (doc.toAmountCents ?? doc.amountCents));
    }
    return paid;
  },

  async clearCardPeriod(cardPeriodId: string, options: WriteOptions = {}): Promise<void> {
    await TransactionModel.updateMany(
      { cardPeriodId: toObjectId(cardPeriodId) },
      { $set: { cardPeriodId: null } },
      { session: options.session },
    );
  },

  /** Every transaction, the trash included, with a part in that category. */
  async findDividedBy(
    categoryId: string,
    options: WriteOptions = {},
  ): Promise<{ id: string; splits: Split[] }[]> {
    const docs = await TransactionModel.find({ 'splits.categoryId': toObjectId(categoryId) }, { splits: 1 })
      .session(options.session ?? null)
      .lean<Pick<TransactionDoc, '_id' | 'splits'>[]>();
    return docs.map((doc) => ({
      id: doc._id.toString(),
      splits: doc.splits.map((part) => ({
        categoryId: part.categoryId.toString(),
        amountCents: part.amountCents,
      })),
    }));
  },

  /** Changes only how a transaction is filed: its category, or the parts it is divided in. */
  async setFiling(id: string, filing: Filing, options: WriteOptions = {}): Promise<void> {
    await TransactionModel.updateOne(
      { _id: toObjectId(id) },
      {
        $set: {
          categoryId: toObjectIdOrNull(filing.categoryId),
          splits: filing.splits.map((part) => ({
            categoryId: toObjectId(part.categoryId),
            amountCents: part.amountCents,
          })),
        },
      },
      { session: options.session },
    );
  },

  /**
   * Keys ("date|amountCents|currency") of live transactions on the given
   * days, by their own amount and by the amount of the receipt they came from
   * when that was in another currency. Used to spot a movement uploaded twice.
   */
  async amountKeysOn(dates: readonly string[]): Promise<Set<string>> {
    if (dates.length === 0) return new Set();
    const docs = await TransactionModel.find(
      { deletedAt: null, date: { $in: [...dates] } },
      { date: 1, amountCents: 1, currency: 1, original: 1 },
    ).lean<Pick<TransactionDoc, 'date' | 'amountCents' | 'currency' | 'original'>[]>();
    const keys = new Set<string>();
    for (const doc of docs) {
      keys.add(duplicateKey(doc.date, doc.amountCents, doc.currency));
      if (doc.original) keys.add(duplicateKey(doc.date, doc.original.amountCents, doc.original.currency));
    }
    return keys;
  },

  /** Keys (installmentKey) of the live installments charged for one of these amounts. */
  async installmentKeys(amounts: readonly number[]): Promise<Set<string>> {
    if (amounts.length === 0) return new Set();
    const docs = await TransactionModel.find(
      { deletedAt: null, installment: { $ne: null }, amountCents: { $in: [...amounts] } },
      { amountCents: 1, currency: 1, installment: 1 },
    ).lean<Pick<TransactionDoc, 'amountCents' | 'currency' | 'installment'>[]>();
    return new Set(
      docs.flatMap((doc) =>
        doc.installment ? [installmentKey(doc.installment, doc.amountCents, doc.currency)] : [],
      ),
    );
  },

  /** Transactions of a document that still count: not in the trash. */
  countLiveByDocument(documentId: string): Promise<number> {
    return TransactionModel.countDocuments({ documentId: toObjectId(documentId), deletedAt: null });
  },

  async releaseDocument(documentId: string, options: WriteOptions = {}): Promise<void> {
    await TransactionModel.updateMany(
      { documentId: toObjectId(documentId) },
      { $set: { documentId: null, source: 'manual' } },
      { session: options.session },
    );
  },

  async trashByDocument(documentId: string, deletedAt: Date, options: WriteOptions = {}): Promise<void> {
    await TransactionModel.updateMany(
      { documentId: toObjectId(documentId), deletedAt: null },
      { $set: { deletedAt, documentId: null } },
      { session: options.session },
    );
  },

  /** Date and payment date of every transaction of an account, the trash included. */
  async findPaymentDates(accountId: string): Promise<PaymentDateRow[]> {
    const docs = await TransactionModel.find(
      { accountId: toObjectId(accountId) },
      { date: 1, paymentDate: 1 },
    ).lean<Pick<TransactionDoc, '_id' | 'date' | 'paymentDate'>[]>();
    return docs.map((doc) => ({ id: doc._id.toString(), date: doc.date, paymentDate: doc.paymentDate }));
  },

  async setPaymentDates(
    updates: readonly { id: string; paymentDate: string }[],
    options: WriteOptions = {},
  ): Promise<void> {
    if (updates.length === 0) return;
    await TransactionModel.bulkWrite(
      updates.map((update) => ({
        updateOne: {
          filter: { _id: toObjectId(update.id) },
          update: { $set: { paymentDate: update.paymentDate } },
        },
      })),
      { session: options.session },
    );
  },

  /**
   * What each live purchase or credit adds to an account's bill: expenses
   * positive, incomes and refunds negative. Projected installments count,
   * drafts do not.
   */
  async findCharges(accountId: string): Promise<ChargeRow[]> {
    const docs = await TransactionModel.find(
      {
        accountId: toObjectId(accountId),
        deletedAt: null,
        status: { $in: ['confirmed', 'projected'] },
        type: { $in: ['expense', 'income'] },
      },
      { date: 1, paymentDate: 1, type: 1, refund: 1, amountCents: 1 },
    ).lean<Pick<TransactionDoc, 'date' | 'paymentDate' | 'type' | 'refund' | 'amountCents'>[]>();
    return docs.map((doc) => ({
      date: doc.date,
      paymentDate: doc.paymentDate,
      signedCents:
        doc.type === 'expense'
          ? spendingCents({ refund: doc.refund ?? false, amountCents: doc.amountCents })
          : -doc.amountCents,
    }));
  },

  /** Projected installments whose day has come become confirmed. Returns how many. */
  async confirmProjectedUpTo(date: string): Promise<number> {
    const result = await TransactionModel.updateMany(
      { status: 'projected', date: { $lte: date } },
      { $set: { status: 'confirmed' } },
    );
    return result.modifiedCount;
  },

  /** Sends to the trash every live transaction of an installment plan. Returns how many. */
  async trashByPlan(planId: string, deletedAt: Date, options: WriteOptions = {}): Promise<number> {
    const result = await TransactionModel.updateMany(
      { 'installment.planId': toObjectId(planId), deletedAt: null },
      { $set: { deletedAt } },
      { session: options.session },
    );
    return result.modifiedCount;
  },

  async pullTag(tagId: string, options: WriteOptions = {}): Promise<void> {
    const id = toObjectId(tagId);
    await TransactionModel.updateMany(
      { tagIds: id },
      { $pull: { tagIds: id } },
      { session: options.session },
    );
  },

  /**
   * Every receipt line of the confirmed expenses bought in a date range, each
   * with the purchase it belongs to. The basis of the consumption report. The
   * lines of a refund are things given back: they count against.
   */
  async findItems(range: { from?: string; to?: string }): Promise<ConsumptionItem[]> {
    const date = {
      ...(range.from ? { $gte: range.from } : {}),
      ...(range.to ? { $lte: range.to } : {}),
    };
    const docs = await TransactionModel.find(
      {
        deletedAt: null,
        status: 'confirmed',
        type: 'expense',
        'items.0': { $exists: true },
        ...(range.from || range.to ? { date } : {}),
      },
      { date: 1, description: 1, currency: 1, refund: 1, items: 1 },
    )
      .sort({ date: -1, createdAt: -1 })
      .lean<Pick<TransactionDoc, '_id' | 'date' | 'description' | 'currency' | 'refund' | 'items'>[]>();
    return docs.flatMap((doc) =>
      doc.items.map((item) => ({
        transactionId: doc._id.toString(),
        date: doc.date,
        description: doc.description ?? '',
        currency: doc.currency,
        ...givenBack(toItem(item), doc.refund ?? false),
      })),
    );
  },

  /** The rate of the most recent live transaction converted from the given currency. */
  async findLastRate(currency: string): Promise<LastRate> {
    const doc = await TransactionModel.findOne(
      { deletedAt: null, 'original.currency': currency },
      { date: 1, original: 1 },
    )
      .sort({ date: -1, createdAt: -1 })
      .lean<Pick<TransactionDoc, 'date' | 'original'>>();
    return { rate: doc?.original?.rate ?? null, date: doc?.date ?? null };
  },

  /**
   * What each income or expense paid in a month adds to its category; a
   * divided one, part by part. Refunds take away. Counts what `totalsByMonth` counts.
   */
  async findFiledByMonth(month: string): Promise<FiledAmount[]> {
    const docs = await TransactionModel.find(
      {
        deletedAt: null,
        status: 'confirmed',
        type: { $in: ['income', 'expense'] },
        paymentDate: { $gte: firstDayOfMonth(month), $lte: lastDayOfMonth(month) },
      },
      { type: 1, refund: 1, currency: 1, amountCents: 1, categoryId: 1, splits: 1 },
    ).lean<
      Pick<TransactionDoc, 'type' | 'refund' | 'currency' | 'amountCents' | 'categoryId' | 'splits'>[]
    >();
    return docs.flatMap((doc) =>
      filedAmounts({
        type: doc.type,
        refund: doc.refund ?? false,
        currency: doc.currency,
        amountCents: doc.amountCents,
        categoryId: idString(doc.categoryId),
        splits: (doc.splits ?? []).map((part) => ({
          categoryId: part.categoryId.toString(),
          amountCents: part.amountCents,
        })),
      }),
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
      {
        $group: {
          _id: { currency: '$currency', type: '$type' },
          // A refund takes away from the expenses, as spendingCents does.
          total: { $sum: { $cond: ['$refund', { $multiply: ['$amountCents', -1] }, '$amountCents'] } },
        },
      },
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
      { date: 1, amountCents: 1, accountId: 1, splits: 1 },
    ).lean<Pick<TransactionDoc, 'date' | 'amountCents' | 'accountId' | 'splits'>[]>();
    // A split transaction is exported as one row per part, so each part counts too.
    return new Set(
      docs.flatMap((doc) =>
        [doc.amountCents, ...(doc.splits ?? []).map((split) => split.amountCents)].map((amountCents) =>
          duplicateKey(doc.date, amountCents, doc.accountId.toString()),
        ),
      ),
    );
  },
};

export type TransactionsRepository = typeof transactionsRepository;
