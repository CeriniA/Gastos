import mongoose, { type ClientSession } from 'mongoose';

/**
 * Opaque handle services pass down to repositories so that several writes
 * succeed or fail together. Services never use it for anything else.
 */
export type DbSession = ClientSession;

export interface WriteOptions {
  session?: DbSession;
}

/**
 * How services run several writes as one unit. They receive it from the
 * composition root instead of importing the database, which also lets tests
 * swap in an in-memory version.
 */
export type TransactionRunner = <T>(
  work: (session: DbSession) => Promise<T>,
  existing?: DbSession,
) => Promise<T>;

/**
 * Runs `work` inside a MongoDB transaction: either every write commits or
 * none does. Pass an existing session to join an outer transaction.
 * Requires a replica set, which MongoDB Atlas always provides.
 */
export const withTransaction: TransactionRunner = async <T>(
  work: (session: DbSession) => Promise<T>,
  existing?: DbSession,
): Promise<T> => {
  if (existing) return work(existing);
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
};
