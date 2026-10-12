import { Schema, model } from 'mongoose';
import { CATEGORY_KINDS, CURRENCIES, type CategoryKind, type Currency } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

/** Stage 4: an income or expense the user marked as fixed, expected every month. */
export interface RecurringDoc {
  _id: ObjectId;
  name: string;
  nameKey: string;
  type: CategoryKind;
  expectedAmountCents: number;
  currency: Currency;
  accountId: ObjectId;
  categoryId: ObjectId | null;
  dayOfMonth: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LAST_DAY_OF_MONTH = 31;

const schema = new Schema<RecurringDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: [...CATEGORY_KINDS] },
    expectedAmountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, enum: [...CURRENCIES] },
    accountId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, default: null },
    dayOfMonth: { type: Number, required: true, min: 1, max: LAST_DAY_OF_MONTH },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const RecurringModel = model<RecurringDoc>('Recurring', schema, COLLECTIONS.recurrings);
