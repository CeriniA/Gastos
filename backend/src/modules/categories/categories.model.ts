import { Schema, model } from 'mongoose';
import { CATEGORY_KINDS, type CategoryKind } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

export interface CategoryDoc {
  _id: ObjectId;
  name: string;
  nameKey: string;
  kind: CategoryKind;
  /** Null for a root category. The tree is at most MAX_CATEGORY_DEPTH levels. */
  parentId: ObjectId | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    kind: { type: String, required: true, enum: [...CATEGORY_KINDS] },
    parentId: { type: Schema.Types.ObjectId, default: null },
    archived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

// Two siblings of the same kind cannot share a name.
uniquePerUser(schema, { kind: 1, parentId: 1, nameKey: 1 });

schema.plugin(ownedByUser);

export const CategoryModel = model<CategoryDoc>('Category', schema, COLLECTIONS.categories);
