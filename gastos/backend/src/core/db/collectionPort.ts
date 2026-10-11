import mongoose, { type Model } from 'mongoose';
import type { BrokenReference } from '@gastos/shared';
import type { DbSession } from './transaction';

const { EJSON } = mongoose.mongo.BSON;

/** A field of this collection that must point at an existing document elsewhere. */
export interface Reference {
  /** Field path, e.g. "accountId" or "splits.categoryId". */
  field: string;
  /** Name of the collection it points at. */
  to: string;
  /** Array to unwind before checking: "tagIds" or "splits". */
  unwind?: string;
}

/**
 * What a module exposes about its collection to the backup and integrity
 * services, so those never import another module's model.
 */
export interface CollectionPort {
  name: string;
  references: readonly Reference[];
  dump(): Promise<unknown[]>;
  replaceAll(documents: readonly unknown[], session: DbSession): Promise<number>;
  findBrokenReferences(session?: DbSession): Promise<BrokenReference[]>;
}

export function createCollectionPort<T>(
  model: Model<T>,
  references: readonly Reference[] = [],
): CollectionPort {
  const name = model.collection.collectionName;
  return {
    name,
    references,

    async dump() {
      const documents = await model.collection.find({}).toArray();
      return documents.map((document) => EJSON.serialize(document, { relaxed: false }));
    },

    async replaceAll(documents, session) {
      await model.collection.deleteMany({}, { session });
      if (documents.length === 0) return 0;
      const restored = documents.map((document) => EJSON.deserialize(document as never, { relaxed: false }));
      const result = await model.collection.insertMany(restored as never[], { session });
      return result.insertedCount;
    },

    async findBrokenReferences(session) {
      const broken: BrokenReference[] = [];
      for (const reference of references) {
        const pipeline: Record<string, unknown>[] = [];
        if (reference.unwind) pipeline.push({ $unwind: `$${reference.unwind}` });
        pipeline.push(
          { $match: { [reference.field]: { $ne: null } } },
          { $lookup: { from: reference.to, localField: reference.field, foreignField: '_id', as: 'target' } },
          { $match: { target: { $size: 0 } } },
          { $project: { missing: `$${reference.field}` } },
          { $limit: 100 },
        );
        const rows = await model.collection.aggregate(pipeline, { session }).toArray();
        for (const row of rows) {
          broken.push({
            collection: name,
            documentId: String(row._id),
            field: reference.field,
            missingId: String(row.missing),
            references: reference.to,
          });
        }
      }
      return broken;
    },
  };
}
