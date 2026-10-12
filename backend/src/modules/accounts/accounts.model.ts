import { Schema, model } from 'mongoose';
import { ACCOUNT_TYPES, CURRENCIES, type AccountType, type Currency } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

export interface AccountDoc {
  _id: ObjectId;
  name: string;
  /** Normalised name; the unique index lives here. */
  nameKey: string;
  type: AccountType;
  currency: Currency;
  bankId: ObjectId | null;
  networkId: ObjectId | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AccountDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: [...ACCOUNT_TYPES] },
    currency: { type: String, required: true, enum: [...CURRENCIES] },
    bankId: { type: Schema.Types.ObjectId, default: null },
    networkId: { type: Schema.Types.ObjectId, default: null },
    archived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

export const AccountModel = model<AccountDoc>('Account', schema, COLLECTIONS.accounts);
