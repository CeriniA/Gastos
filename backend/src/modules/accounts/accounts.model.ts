import { Schema, model } from 'mongoose';
import {
  ACCOUNT_TYPES,
  CURRENCIES,
  type AccountType,
  type Currency,
  type OpeningBalance,
} from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
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
  /** What it had on a day, where its balance starts counting. Null: from zero, since its first movement. */
  openingBalance: OpeningBalance | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AccountDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    type: { type: String, required: true, enum: [...ACCOUNT_TYPES] },
    currency: { type: String, required: true, enum: [...CURRENCIES] },
    bankId: { type: Schema.Types.ObjectId, default: null },
    networkId: { type: Schema.Types.ObjectId, default: null },
    openingBalance: {
      type: new Schema<OpeningBalance>(
        { amountCents: { type: Number, required: true }, date: { type: String, required: true } },
        { _id: false },
      ),
      default: null,
    },
    archived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

uniquePerUser(schema, { nameKey: 1 });
schema.plugin(ownedByUser);

export const AccountModel = model<AccountDoc>('Account', schema, COLLECTIONS.accounts);
