import mongoose, { type Model } from 'mongoose';
import type { BrokenReference } from '@gastos/shared';
import { AppError } from '../errors/errors';
import { isDuplicateKey } from './mongoErrors';
import { ownedOnly, stampOwner } from './ownerPlugin';
import type { DbSession } from './transaction';

const { EJSON } = mongoose.mongo.BSON;
/** How many broken references of one kind the integrity check lists. */
const BROKEN_REFERENCES_LIMIT = 100;

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
  /**
   * True for what belongs to the app and not to a user (the list of applied
   * migrations): it travels in a backup, and a restore reads it but never writes it.
   */
  shared: boolean;
  dump(): Promise<unknown[]>;
  replaceAll(documents: readonly unknown[], session: DbSession): Promise<number>;
  findBrokenReferences(session?: DbSession): Promise<BrokenReference[]>;
}

/**
 * The port of a collection of user data. It works through the driver, so it
 * narrows to the running user itself: a backup holds one user's documents and
 * a restore replaces only theirs, making them the owner of whatever comes in.
 */
export function createCollectionPort<T>(
  model: Model<T>,
  references: readonly Reference[] = [],
  options: { shared?: boolean } = {},
): CollectionPort {
  const name = model.collection.collectionName;
  const shared = options.shared ?? false;
  const mine = () => (shared ? {} : ownedOnly());

  return {
    name,
    references,
    shared,

    async dump() {
      const documents = await model.collection.find(mine()).toArray();
      return documents.map((document) => EJSON.serialize(document, { relaxed: false }));
    },

    async replaceAll(documents, session) {
      await model.collection.deleteMany(mine(), { session });
      if (documents.length === 0) return 0;
      const restored = documents.map((document) =>
        stampOwner(EJSON.deserialize(document as never, { relaxed: false })),
      );
      try {
        const result = await model.collection.insertMany(restored as never[], { session });
        return result.insertedCount;
      } catch (error) {
        // The same documents already exist as somebody else's: ids are unique across users.
        if (isDuplicateKey(error)) {
          throw new AppError(400, 'INVALID_BACKUP', 'The backup holds data that another user has', {
            reason: 'other_user',
            collection: name,
          });
        }
        throw error;
      }
    },

    async findBrokenReferences(session) {
      const broken: BrokenReference[] = [];
      for (const reference of references) {
        const pipeline: Record<string, unknown>[] = [{ $match: mine() }];
        if (reference.unwind) pipeline.push({ $unwind: `$${reference.unwind}` });
        pipeline.push(
          { $match: { [reference.field]: { $ne: null } } },
          { $lookup: { from: reference.to, localField: reference.field, foreignField: '_id', as: 'target' } },
          { $match: { target: { $size: 0 } } },
          { $project: { missing: `$${reference.field}` } },
          { $limit: BROKEN_REFERENCES_LIMIT },
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
