import type { Schema } from 'mongoose';
import { uniquePerUser } from './ownerPlugin';

/** Name of the index that keeps a known text pointing at one item only. */
export const ALIAS_INDEX_NAME = 'userId_aliasKeys_unique';

/**
 * A known text points at one merchant or product only. MongoDB indexes an
 * empty list as one "undefined" entry, so a plain unique index would let a
 * user have a single item without known texts: the index only covers items
 * that have some.
 */
export function uniqueAliasesPerUser(schema: Schema): void {
  uniquePerUser(
    schema,
    { aliasKeys: 1 },
    { name: ALIAS_INDEX_NAME, partialFilterExpression: { 'aliasKeys.0': { $exists: true } } },
  );
}
