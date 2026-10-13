import { Schema, model } from 'mongoose';
import { runAsSystem } from '../context/owner';
import { logger } from '../logger';
import { createCollectionPort } from './collectionPort';
import { COLLECTIONS } from './collections';

/**
 * Numbered, run-once scripts that change stored data when the structure
 * evolves. Add new ones to src/migrations/index.ts; never edit one that has
 * already run against real data.
 *
 * A migration changes users' data, so it runs once for each user, as that
 * user: written as if there were only one, like a repository. One marked
 * `system` is about the database as a whole (indexes, who owns what) and runs
 * a single time over everybody's data.
 */
export interface Migration {
  /** Sortable and unique, e.g. "2026-11-01-add-refund-flag". */
  id: string;
  system?: boolean;
  up(): Promise<void>;
}

/** Runs some work once for every user, as that user. */
export type ForEachUser = (work: () => Promise<void>) => Promise<void>;

interface MigrationDoc {
  _id: string;
  appliedAt: Date;
}

const MigrationModel = model<MigrationDoc>(
  'Migration',
  new Schema<MigrationDoc>({ _id: String, appliedAt: { type: Date, required: true } }),
  COLLECTIONS.migrations,
);

/** The list of applied migrations travels in every backup, and no restore replaces it. */
export const migrationsPort = createCollectionPort(MigrationModel, [], { shared: true });

const inOrder = (migrations: readonly Migration[]) =>
  [...migrations].sort((a, b) => a.id.localeCompare(b.id));

/** At startup: runs what was never applied to this database, and remembers it. */
export async function runMigrations(
  migrations: readonly Migration[],
  forEachUser: ForEachUser,
): Promise<string[]> {
  const applied = new Set((await MigrationModel.find().lean()).map((doc) => doc._id));
  const ran: string[] = [];
  for (const migration of inOrder(migrations)) {
    if (applied.has(migration.id)) continue;
    logger.info({ migration: migration.id }, 'Running migration');
    if (migration.system) await runAsSystem(() => migration.up());
    else await forEachUser(() => migration.up());
    await MigrationModel.create({ _id: migration.id, appliedAt: new Date() });
    ran.push(migration.id);
  }
  return ran;
}

/**
 * After a restore: brings the running user's restored data up to date with the
 * migrations its backup had not been through. Nothing is remembered, since the
 * database as a whole already had them.
 */
export async function runMissingMigrations(
  migrations: readonly Migration[],
  alreadyApplied: readonly string[],
): Promise<void> {
  for (const migration of inOrder(migrations)) {
    if (migration.system || alreadyApplied.includes(migration.id)) continue;
    await migration.up();
  }
}
