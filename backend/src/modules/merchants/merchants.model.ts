import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

export interface MerchantDoc {
  _id: ObjectId;
  name: string;
  nameKey: string;
  /** Suggested when the merchant is chosen; null for none. */
  defaultCategoryId: ObjectId | null;
  /** Known texts as the user wrote them, and the same ignoring case and accents. */
  aliases: string[];
  aliasKeys: string[];
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<MerchantDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    defaultCategoryId: { type: Schema.Types.ObjectId, default: null },
    aliases: { type: [String], default: [] },
    aliasKeys: { type: [String], default: [] },
    archived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

uniquePerUser(schema, { nameKey: 1 });
// A known text points at one merchant only. Empty lists add nothing to the index.
uniquePerUser(schema, { aliasKeys: 1 });
schema.plugin(ownedByUser);

export const MerchantModel = model<MerchantDoc>('Merchant', schema, COLLECTIONS.merchants);
