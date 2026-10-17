import { Schema, model } from 'mongoose';
import {
  CATEGORY_KINDS,
  CURRENCIES,
  MAX_DAY_OF_MONTH,
  type CategoryKind,
  type Currency,
} from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

/** An income or expense the user marked as fixed, expected every month. */
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
  /** The user said this merchant is not fixed: it is not suggested again. */
  ignored: boolean;
  /** The normalised description its transactions are recognised by. */
  merchantKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<RecurringDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    type: { type: String, required: true, enum: [...CATEGORY_KINDS] },
    expectedAmountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, enum: [...CURRENCIES] },
    accountId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, default: null },
    dayOfMonth: { type: Number, required: true, min: 1, max: MAX_DAY_OF_MONTH },
    active: { type: Boolean, required: true, default: true },
    ignored: { type: Boolean, required: true, default: false },
    merchantKey: { type: String, default: '' },
  },
  { timestamps: true },
);

// Netflix in pesos and Netflix in dollars are two fixed items, as their merchant is matched by kind and currency.
uniquePerUser(schema, { nameKey: 1, type: 1, currency: 1 });
schema.plugin(ownedByUser);

export const RecurringModel = model<RecurringDoc>('Recurring', schema, COLLECTIONS.recurrings);
