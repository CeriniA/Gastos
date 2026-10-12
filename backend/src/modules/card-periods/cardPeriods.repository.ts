import type { CardPeriod } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { CardPeriodModel, type CardPeriodDoc } from './cardPeriods.model';

function toPeriod(doc: CardPeriodDoc): CardPeriod {
  return {
    id: doc._id.toString(),
    accountId: doc.accountId.toString(),
    closingDate: doc.closingDate,
    dueDate: doc.dueDate,
    totalCents: doc.totalCents ?? null,
    minimumPaymentCents: doc.minimumPaymentCents ?? null,
    documentId: idString(doc.documentId),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const cardPeriodsPort = createCollectionPort(CardPeriodModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
  { field: 'documentId', to: COLLECTIONS.documents },
]);

export interface PeriodData {
  closingDate: string;
  dueDate: string;
  totalCents: number | null;
  minimumPaymentCents: number | null;
}

export const cardPeriodsRepository = {
  async findAll(options: WriteOptions = {}): Promise<CardPeriod[]> {
    const docs = await CardPeriodModel.find()
      .sort({ closingDate: -1 })
      .session(options.session ?? null)
      .lean<CardPeriodDoc[]>();
    return docs.map(toPeriod);
  },

  async findByAccount(accountId: string): Promise<CardPeriod[]> {
    const docs = await CardPeriodModel.find({ accountId: toObjectId(accountId) })
      .sort({ closingDate: -1 })
      .lean<CardPeriodDoc[]>();
    return docs.map(toPeriod);
  },

  async findById(id: string): Promise<CardPeriod | null> {
    const doc = await CardPeriodModel.findById(toObjectId(id)).lean<CardPeriodDoc>();
    return doc ? toPeriod(doc) : null;
  },

  async create(accountId: string, data: PeriodData, options: WriteOptions = {}): Promise<CardPeriod> {
    const [doc] = await CardPeriodModel.create([{ ...data, accountId: toObjectId(accountId) }], {
      session: options.session,
    });
    return toPeriod(doc!.toObject() as CardPeriodDoc);
  },

  async update(
    id: string,
    changes: Partial<PeriodData>,
    options: WriteOptions = {},
  ): Promise<CardPeriod | null> {
    const doc = await CardPeriodModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: changes },
      { new: true, session: options.session },
    ).lean<CardPeriodDoc>();
    return doc ? toPeriod(doc) : null;
  },

  async delete(id: string, options: WriteOptions = {}): Promise<void> {
    await CardPeriodModel.deleteOne({ _id: toObjectId(id) }, { session: options.session });
  },

  countByAccount(accountId: string): Promise<number> {
    return CardPeriodModel.countDocuments({ accountId: toObjectId(accountId) });
  },
};

export type CardPeriodsRepository = typeof cardPeriodsRepository;
