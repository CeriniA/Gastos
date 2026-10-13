/** MongoDB's code for a unique index violation. */
const MONGO_DUPLICATE_KEY = 11000;

/** True when the database refused a write because a unique value (or an id) already exists. */
export function isDuplicateKey(error: unknown): error is { keyValue?: unknown } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === MONGO_DUPLICATE_KEY;
}
