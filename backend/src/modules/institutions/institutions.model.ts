import { Schema, model } from 'mongoose';
import { INSTITUTION_KINDS, type InstitutionKind } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import { ownedByUser, uniquePerUser } from '../../core/db/ownerPlugin';
import type { ObjectId } from '../../core/db/ids';

export interface InstitutionDoc {
  _id: ObjectId;
  name: string;
  /** Normalised name; unique within its kind. */
  nameKey: string;
  kind: InstitutionKind;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<InstitutionDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    kind: { type: String, required: true, enum: [...INSTITUTION_KINDS] },
    archived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);
// "Naranja" can be both a bank and a card brand, but not twice the same.
uniquePerUser(schema, { kind: 1, nameKey: 1 });

schema.plugin(ownedByUser);

export const InstitutionModel = model<InstitutionDoc>('Institution', schema, COLLECTIONS.institutions);
