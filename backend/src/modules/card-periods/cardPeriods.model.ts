import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

/** Stage 3: one credit card statement period, with its closing and due dates. */
export interface CardPeriodDoc {
  _id: ObjectId;
  accountId: ObjectId;
  closingDate: string;
  dueDate: string;
  totalCents: number | null;
  minimumPaymentCents: number | null;
  /** The statement the dates were read from, when there is one. */
  documentId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CardPeriodDoc>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true },
    closingDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    totalCents: { type: Number, default: null },
    minimumPaymentCents: { type: Number, default: null },
    documentId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
// One period per card and closing date.
uniquePerUser(schema, { accountId: 1, closingDate: 1 });

schema.plugin(ownedByUser);

export const CardPeriodModel = model<CardPeriodDoc>('CardPeriod', schema, COLLECTIONS.cardPeriods);
