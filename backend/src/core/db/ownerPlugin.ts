import mongoose, { Schema, type IndexOptions, type Model, type Types } from 'mongoose';
import { ownerFilter } from '../context/owner';
import { toObjectId } from './ids';

/** The field every owned document carries. Indexes that must be unique per user start with it. */
export const OWNER_FIELD = 'userId';

/** Every way Mongoose reads, changes or deletes through a query. */
const QUERY_METHODS = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
] as const;

/** The owner as stored, or null when the code runs for every user (`runAsSystem`). */
export function ownerId(): Types.ObjectId | null {
  const userId = ownerFilter();
  return userId === null ? null : toObjectId(userId);
}

/** What narrows any filter to the running user's documents. Empty when running for every user. */
export function ownedOnly(): Record<string, Types.ObjectId> {
  const owner = ownerId();
  return owner ? { [OWNER_FIELD]: owner } : {};
}

/** Marks a document about to be stored as the running user's, whatever it said before. */
export function stampOwner<T extends object>(document: T): T {
  const owner = ownerId();
  if (owner) (document as Record<string, unknown>)[OWNER_FIELD] = owner;
  return document;
}

/** One operation of a bulk write, narrowed (or stamped) like a single one would be. */
export function ownBulkOperation(operation: Record<string, unknown>): void {
  for (const command of Object.values(operation)) {
    const body = command as { filter?: object; document?: object };
    if (body.document) stampOwner(body.document);
    else body.filter = { ...body.filter, ...ownedOnly() };
  }
}

/** Every registered model whose documents belong to a user. */
export function ownedModels(): Model<unknown>[] {
  return Object.values(mongoose.models).filter(
    (candidate) => candidate.schema.path(OWNER_FIELD) !== undefined,
  );
}

/**
 * A value no two documents of the same user may share ("one account per
 * name"). Two users can each have their own.
 */
export function uniquePerUser(
  schema: Schema,
  fields: Record<string, 1>,
  options: IndexOptions = {},
): void {
  schema.index({ [OWNER_FIELD]: 1, ...fields }, { ...options, unique: true });
}

/**
 * Makes a collection belong to users: each document carries its owner, every
 * query only sees the running user's documents and every new document is
 * stamped with them. Repositories are written as if there were one user.
 *
 * Add it to the schema of every collection that holds a user's data. Code that
 * goes around Mongoose (the driver, as the backup does) must use `ownedOnly`
 * and `stampOwner` itself.
 */
export function ownedByUser(schema: Schema): void {
  schema.add({ [OWNER_FIELD]: { type: Schema.Types.ObjectId, required: true, index: true } });

  schema.pre([...QUERY_METHODS], { query: true, document: false }, function () {
    this.where(ownedOnly());
  });
  schema.pre('aggregate', function () {
    this.pipeline().unshift({ $match: ownedOnly() });
  });
  // Before validation, so the required owner is there when it is checked.
  schema.pre('validate', function () {
    const owner = ownerId();
    if (owner) this.set(OWNER_FIELD, owner);
  });
  schema.pre('insertMany', function (next, documents: object | object[]) {
    for (const document of [documents].flat()) stampOwner(document);
    next();
  });
  schema.pre('bulkWrite', function (next, operations) {
    for (const operation of operations) ownBulkOperation(operation as Record<string, unknown>);
    next();
  });
}
