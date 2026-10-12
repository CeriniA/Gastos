import type { Institution, InstitutionKind } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { toObjectId } from '../../core/db/ids';
import { InstitutionModel, type InstitutionDoc } from './institutions.model';

function toInstitution(doc: InstitutionDoc): Institution {
  return {
    id: doc._id.toString(),
    name: doc.name,
    kind: doc.kind,
    archived: doc.archived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const institutionsPort = createCollectionPort(InstitutionModel);

export const institutionsRepository = {
  async findAll(): Promise<Institution[]> {
    const docs = await InstitutionModel.find().sort({ kind: 1, nameKey: 1 }).lean<InstitutionDoc[]>();
    return docs.map(toInstitution);
  },

  async findById(id: string): Promise<Institution | null> {
    const doc = await InstitutionModel.findById(toObjectId(id)).lean<InstitutionDoc>();
    return doc ? toInstitution(doc) : null;
  },

  async findByNameKey(kind: InstitutionKind, nameKey: string): Promise<Institution | null> {
    const doc = await InstitutionModel.findOne({ kind, nameKey }).lean<InstitutionDoc>();
    return doc ? toInstitution(doc) : null;
  },

  async create(data: { name: string; nameKey: string; kind: InstitutionKind }): Promise<Institution> {
    const doc = await InstitutionModel.create(data);
    return toInstitution(doc.toObject() as InstitutionDoc);
  },

  async update(
    id: string,
    changes: Partial<{ name: string; nameKey: string; archived: boolean }>,
  ): Promise<Institution | null> {
    const doc = await InstitutionModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: changes },
      { new: true },
    ).lean<InstitutionDoc>();
    return doc ? toInstitution(doc) : null;
  },

  async delete(id: string): Promise<void> {
    await InstitutionModel.deleteOne({ _id: toObjectId(id) });
  },
};

export type InstitutionsRepository = typeof institutionsRepository;
