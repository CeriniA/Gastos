import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

export interface TagDoc {
  _id: ObjectId;
  name: string;
  nameKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<TagDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
  },
  { timestamps: true },
);

uniquePerUser(schema, { nameKey: 1 });
schema.plugin(ownedByUser);

export const TagModel = model<TagDoc>('Tag', schema, COLLECTIONS.tags);
