import { Schema, model } from 'mongoose';
import { logger } from '../logger';
import { createCollectionPort } from './collectionPort';
import { COLLECTIONS } from './collections';

/**
 * Numbered, run-once scripts that change stored data when the structure
 * evolves. Add new ones to src/migrations/index.ts; never edit one that has
 * already run against real data.
 */
export interface Migration {
  /** Sortable and unique, e.g. "2026-11-01-add-refund-flag". */
  id: string;
  up(): Promise<void>;
}

interface MigrationDoc {
  _id: string;
  appliedAt: Date;
}

const MigrationModel = model<MigrationDoc>(
  'Migration',
  new Schema<MigrationDoc>({ _id: String, appliedAt: { type: Date, required: true } }),
  COLLECTIONS.migrations,
);

export const migrationsPort = createCollectionPort(MigrationModel);

export async function runMigrations(migrations: readonly Migration[]): Promise<string[]> {
  const applied = new Set((await MigrationModel.find().lean()).map((doc) => doc._id));
  const ran: string[] = [];
  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (applied.has(migration.id)) continue;
    logger.info({ migration: migration.id }, 'Running migration');
    await migration.up();
    await MigrationModel.create({ _id: migration.id, appliedAt: new Date() });
    ran.push(migration.id);
  }
  return ran;
}
