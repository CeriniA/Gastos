import type { ExchangeRate, ExchangeRateInput } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { toObjectId } from '../../core/db/ids';
import { ExchangeRateModel, type ExchangeRateDoc } from './exchangeRates.model';

function toRate(doc: ExchangeRateDoc): ExchangeRate {
  return {
    id: doc._id.toString(),
    validFrom: doc.validFrom,
    arsPerUsd: doc.arsPerUsd,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const exchangeRatesPort = createCollectionPort(ExchangeRateModel, []);

export const exchangeRatesRepository = {
  /** Oldest first: each one is valid until the next one starts. */
  async findAll(): Promise<ExchangeRate[]> {
    const docs = await ExchangeRateModel.find().sort({ validFrom: 1 }).lean<ExchangeRateDoc[]>();
    return docs.map(toRate);
  },

  async findByValidFrom(validFrom: string): Promise<ExchangeRate | null> {
    const doc = await ExchangeRateModel.findOne({ validFrom }).lean<ExchangeRateDoc>();
    return doc ? toRate(doc) : null;
  },

  async create(data: ExchangeRateInput): Promise<ExchangeRate> {
    const doc = await ExchangeRateModel.create(data);
    return toRate(doc.toObject() as ExchangeRateDoc);
  },

  async update(id: string, data: ExchangeRateInput): Promise<ExchangeRate | null> {
    const doc = await ExchangeRateModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: data },
      { new: true, runValidators: true },
    ).lean<ExchangeRateDoc>();
    return doc ? toRate(doc) : null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await ExchangeRateModel.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  },
};

export type ExchangeRatesRepository = typeof exchangeRatesRepository;
