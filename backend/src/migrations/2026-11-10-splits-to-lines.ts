import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import type { Migration } from '../core/db/migrations';
import { ownedOnly } from '../core/db/ownerPlugin';
import { TransactionModel } from '../modules/transactions/transactions.model';
import { splitsToLines, type StoredSplit } from './splitLines';

/** Transactions updated per request to the database. */
const BATCH_SIZE = 500;

/**
 * Divisions of a payment become lines (see `splitsToLines`). It goes through the
 * driver because the model no longer has `splits`: the field is read as stored
 * and removed once its parts are lines. What is not divided is not touched, so
 * it can run again.
 */
export const splitsToLinesMigration: Migration = {
  id: '2026-11-10-splits-to-lines',
  async up() {
    const collection = TransactionModel.collection;
    const cursor = collection.find({ ...ownedOnly(), 'splits.0': { $exists: true } });
    let batch: AnyBulkWriteOperation[] = [];
    for await (const doc of cursor) {
      const stored = doc.splits as { categoryId: ObjectId; amountCents: number }[];
      // The ids come back as text from the pure function; they are stored as ObjectId.
      const objectIds = new Map(stored.map((part) => [part.categoryId.toString(), part.categoryId]));
      const splits = stored.map((part): StoredSplit => ({ ...part, categoryId: part.categoryId.toString() }));
      const result = splitsToLines(splits, (doc.items ?? []) as { productId?: unknown; categoryId?: unknown }[]);
      const items = result.items.map((item) =>
        typeof item.categoryId === 'string' ? { ...item, categoryId: objectIds.get(item.categoryId) } : item,
      );
      batch.push({
        updateOne: {
          filter: { _id: doc._id, ...ownedOnly() },
          update: { $set: { categoryId: objectIds.get(result.categoryId), items }, $unset: { splits: '' } },
        },
      });
      if (batch.length >= BATCH_SIZE) {
        await collection.bulkWrite(batch);
        batch = [];
      }
    }
    if (batch.length > 0) await collection.bulkWrite(batch);
  },
};
