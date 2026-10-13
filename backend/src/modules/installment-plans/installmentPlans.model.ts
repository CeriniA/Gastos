import { Schema, model } from 'mongoose';
import { CURRENCIES, type Currency } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

/** Stage 3: a purchase paid in installments; its transactions link back through installment.planId. */
export interface InstallmentPlanDoc {
  _id: ObjectId;
  accountId: ObjectId;
  description: string;
  purchaseDate: string;
  /** Total of the purchase. Each installment's real amount lives on its transaction. */
  totalAmountCents: number;
  currency: Currency;
  installments: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<InstallmentPlanDoc>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true },
    description: { type: String, default: '' },
    purchaseDate: { type: String, required: true },
    totalAmountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, enum: [...CURRENCIES] },
    installments: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

schema.plugin(ownedByUser);

export const InstallmentPlanModel = model<InstallmentPlanDoc>(
  'InstallmentPlan',
  schema,
  COLLECTIONS.installmentPlans,
);
