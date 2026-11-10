import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

export interface ProductDoc {
  _id: ObjectId;
  name: string;
  nameKey: string;
  categoryId: ObjectId;
  /** Known texts as the user wrote them, and the same ignoring case and accents. */
  aliases: string[];
  aliasKeys: string[];
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    aliases: { type: [String], default: [] },
    aliasKeys: { type: [String], default: [] },
    archived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

uniquePerUser(schema, { nameKey: 1 });
// A known text points at one product only. Empty lists add nothing to the index.
uniquePerUser(schema, { aliasKeys: 1 });
schema.plugin(ownedByUser);

export const ProductModel = model<ProductDoc>('Product', schema, COLLECTIONS.products);
