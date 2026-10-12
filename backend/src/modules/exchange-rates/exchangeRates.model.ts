import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

/** Stage 4: manual ARS/USD rates by start date, used only when a report shows both currencies together. */
export interface ExchangeRateDoc {
  _id: ObjectId;
  /** First day the rate applies; it stays valid until the next one starts. */
  validFrom: string;
  /** Pesos per dollar, entered by the user. A rate, not an amount of money. */
  arsPerUsd: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A rate of zero would make every conversion zero. */
const MIN_RATE = 0.0001;

const schema = new Schema<ExchangeRateDoc>(
  {
    validFrom: { type: String, required: true, unique: true },
    arsPerUsd: { type: Number, required: true, min: MIN_RATE },
  },
  { timestamps: true },
);

export const ExchangeRateModel = model<ExchangeRateDoc>('ExchangeRate', schema, COLLECTIONS.exchangeRates);
