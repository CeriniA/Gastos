import { Schema, model } from 'mongoose';
import {
  CURRENCIES,
  TRANSACTION_SOURCES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type Currency,
  type TransactionSource,
  type TransactionStatus,
  type TransactionType,
} from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

export interface TransactionDoc {
  _id: ObjectId;
  type: TransactionType;
  /** An expense that gives money back: it takes away from spending instead of adding. */
  refund: boolean;
  status: TransactionStatus;
  source: TransactionSource;
  /** Calendar days as "YYYY-MM-DD" strings: they sort and compare correctly as text. */
  date: string;
  paymentDate: string;
  /** Integer cents, always positive. The type says which way the money moves. */
  amountCents: number;
  currency: Currency;
  /** The amount as printed on a receipt in another currency, and the rate applied. */
  original: { amountCents: number; currency: string; rate: number } | null;
  accountId: ObjectId;
  toAccountId: ObjectId | null;
  toAmountCents: number | null;
  categoryId: ObjectId | null;
  description: string;
  note: string;
  tagIds: ObjectId[];
  /** Embedded: splits and items cannot exist without their transaction. */
  splits: { categoryId: ObjectId; amountCents: number }[];
  items: {
    name: string;
    amountCents: number;
    product?: string;
    group?: string | null;
    quantity?: number | null;
  }[];
  installment: { planId: ObjectId | null; number: number; total: number } | null;
  documentId: ObjectId | null;
  cardPeriodId: ObjectId | null;
  recurringId: ObjectId | null;
  edited: boolean;
  /** Set when the transaction is in the trash. */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const objectIdOrNull = { type: Schema.Types.ObjectId, default: null };
const cents = {
  type: Number,
  required: true,
  validate: { validator: Number.isInteger, message: 'Amounts are integer cents' },
};

const schema = new Schema<TransactionDoc>(
  {
    type: { type: String, required: true, enum: [...TRANSACTION_TYPES] },
    refund: { type: Boolean, required: true, default: false },
    status: { type: String, required: true, enum: [...TRANSACTION_STATUSES] },
    source: { type: String, required: true, enum: [...TRANSACTION_SOURCES] },
    date: { type: String, required: true },
    paymentDate: { type: String, required: true },
    amountCents: { ...cents, min: 1 },
    currency: { type: String, required: true, enum: [...CURRENCIES] },
    original: {
      type: new Schema(
        {
          amountCents: { ...cents, min: 1 },
          currency: { type: String, required: true },
          rate: { type: Number, required: true, min: 0 },
        },
        { _id: false },
      ),
      default: null,
    },
    accountId: { type: Schema.Types.ObjectId, required: true },
    toAccountId: objectIdOrNull,
    toAmountCents: { type: Number, default: null },
    categoryId: objectIdOrNull,
    description: { type: String, default: '' },
    note: { type: String, default: '' },
    tagIds: { type: [Schema.Types.ObjectId], default: [] },
    splits: {
      type: [
        new Schema(
          { categoryId: { type: Schema.Types.ObjectId, required: true }, amountCents: cents },
          { _id: false },
        ),
      ],
      default: [],
    },
    items: {
      type: [
        new Schema(
          {
            name: { type: String, required: true },
            amountCents: cents,
            product: { type: String, default: '' },
            group: { type: String, default: null },
            quantity: { type: Number, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    installment: {
      type: new Schema(
        {
          planId: objectIdOrNull,
          number: { type: Number, required: true, min: 1 },
          total: { type: Number, required: true, min: 1 },
        },
        { _id: false },
      ),
      default: null,
    },
    documentId: objectIdOrNull,
    cardPeriodId: objectIdOrNull,
    recurringId: objectIdOrNull,
    edited: { type: Boolean, required: true, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ deletedAt: 1, paymentDate: -1 });
schema.index({ deletedAt: 1, date: -1, createdAt: -1 });
schema.index({ accountId: 1 });
schema.index({ toAccountId: 1 });
schema.index({ categoryId: 1 });
schema.index({ 'splits.categoryId': 1 });
schema.index({ tagIds: 1 });
schema.index({ documentId: 1 });
schema.index({ 'original.currency': 1, date: -1 });

schema.plugin(ownedByUser);

export const TransactionModel = model<TransactionDoc>('Transaction', schema, COLLECTIONS.transactions);
