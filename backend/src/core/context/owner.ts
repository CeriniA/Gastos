import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Whose data the running code may touch. Every piece of stored data belongs to
 * one user, and the database layer reads the owner from here instead of
 * taking it as an argument, so no query can forget it.
 *
 * It fails closed: code that reaches the data without an owner gets an error,
 * never somebody else's data. Requests enter through `asUser` (core/http);
 * background work enters through `runAsUser`.
 */
type Owner = { userId: string } | { everyone: true };

const storage = new AsyncLocalStorage<Owner>();

/** Runs `work` on behalf of one user: everything it reads or writes is theirs. */
export function runAsUser<T>(userId: string, work: () => T): T {
  return storage.run({ userId }, work);
}

/**
 * Runs `work` over every user's data at once. Only for what is not a user's
 * doing: the migrations at startup.
 */
export function runAsSystem<T>(work: () => T): T {
  return storage.run({ everyone: true }, work);
}

/** The owner to filter by, or null inside `runAsSystem`. Throws when nobody was named. */
export function ownerFilter(): string | null {
  const owner = storage.getStore();
  if (!owner) throw new Error('Data was reached without saying whose it is (see core/context/owner.ts)');
  return 'userId' in owner ? owner.userId : null;
}

/** The user the running code works for. Throws outside `runAsUser`. */
export function currentUserId(): string {
  const userId = ownerFilter();
  if (userId === null) throw new Error('This needs one user, and the code is running for all of them');
  return userId;
}

/** True when the running code was told whose data it works on. */
export function hasOwner(): boolean {
  return storage.getStore() !== undefined;
}
