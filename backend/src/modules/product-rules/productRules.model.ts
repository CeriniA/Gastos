import { Schema, model } from 'mongoose';
import { PRODUCT_GROUPS, type ProductGroup } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

/** "This line of a receipt is this product", remembered from a correction in the review. */
export interface ProductRuleDoc {
  _id: ObjectId;
  /** The line as printed on the receipt. */
  name: string;
  /** Normalised printed text; one rule per line text. */
  nameKey: string;
  product: string;
  group: ProductGroup | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ProductRuleDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    product: { type: String, default: '' },
    group: { type: String, enum: [...PRODUCT_GROUPS, null], default: null },
  },
  { timestamps: true },
);

uniquePerUser(schema, { nameKey: 1 });
schema.plugin(ownedByUser);

export const ProductRuleModel = model<ProductRuleDoc>('ProductRule', schema, COLLECTIONS.productRules);
