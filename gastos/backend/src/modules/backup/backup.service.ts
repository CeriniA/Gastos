import {
  APP_ID,
  BACKUP_FORMAT_VERSION,
  backupFileSchema,
  type BackupFile,
  type BrokenReference,
  type IntegrityReport,
  type RestoreResult,
} from '@gastos/shared';
import type { CollectionPort } from '../../core/db/collectionPort';
import type { DbSession, TransactionRunner } from '../../core/db/transaction';
import { AppError } from '../../core/errors/errors';

export interface BackupHooks {
  /** Runs once the restored data is committed, e.g. to apply pending migrations. */
  afterRestore(): Promise<void>;
}

/**
 * Full backup and restore. Works through the ports each module exposes, so it
 * never imports another module's model and automatically covers new modules
 * once their port is registered in the composition root.
 */
export function createBackupService(
  ports: readonly CollectionPort[],
  hooks: BackupHooks,
  runInTransaction: TransactionRunner,
) {
  async function findBroken(session?: DbSession): Promise<BrokenReference[]> {
    const results = await Promise.all(ports.map((port) => port.findBrokenReferences(session)));
    return results.flat();
  }

  return {
    async exportAll(): Promise<BackupFile> {
      const collections: Record<string, unknown[]> = {};
      for (const port of ports) collections[port.name] = await port.dump();
      return {
        app: APP_ID,
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        collections,
      };
    },

    /**
     * Replaces the whole database with the backup, or changes nothing: the
     * swap and the integrity check run in one transaction.
     */
    async restore(input: unknown): Promise<RestoreResult> {
      const parsed = backupFileSchema.safeParse(input);
      if (!parsed.success) throw new AppError(400, 'INVALID_BACKUP', 'Not a backup file of this app');
      const file = parsed.data;
      if (file.formatVersion > BACKUP_FORMAT_VERSION) {
        throw new AppError(400, 'INVALID_BACKUP', 'Backup was made by a newer version of the app', {
          formatVersion: file.formatVersion,
          supported: BACKUP_FORMAT_VERSION,
        });
      }
      const known = new Set(ports.map((port) => port.name));
      const unknown = Object.keys(file.collections).filter((name) => !known.has(name));
      if (unknown.length > 0) {
        throw new AppError(400, 'INVALID_BACKUP', 'Backup contains unknown collections', { unknown });
      }

      const restored = await runInTransaction(async (session) => {
        const counts: Record<string, number> = {};
        for (const port of ports) {
          counts[port.name] = await port.replaceAll(file.collections[port.name] ?? [], session);
        }
        const broken = await findBroken(session);
        if (broken.length > 0) {
          throw new AppError(400, 'INTEGRITY', 'Backup has references to data it does not contain', {
            broken,
          });
        }
        return counts;
      });
      await hooks.afterRestore();
      return { restored };
    },

    /** Lists every reference that points at a document that no longer exists. */
    async integrity(): Promise<IntegrityReport> {
      const broken = await findBroken();
      return { ok: broken.length === 0, checkedAt: new Date().toISOString(), broken };
    },
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
