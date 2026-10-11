import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

/** Stage 2: "this merchant always goes to this category", created when the user corrects a suggestion. */
export interface CategoryRuleDoc {
  _id: ObjectId;
  /** Merchant name as shown to the user. */
  merchant: string;
  /** Normalised merchant name; one rule per merchant. */
  merchantKey: string;
  categoryId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CategoryRuleDoc>(
  {
    merchant: { type: String, required: true, trim: true },
    merchantKey: { type: String, required: true, unique: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

export const CategoryRuleModel = model<CategoryRuleDoc>('CategoryRule', schema, COLLECTIONS.categoryRules);
