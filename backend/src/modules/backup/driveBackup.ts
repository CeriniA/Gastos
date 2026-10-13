import {
  DRIVE_BACKUP_INTERVAL_HOURS,
  hoursBetween,
  type BackupFile,
  type DriveBackupError,
  type DriveBackupStatus,
} from '@gastos/shared';
import { BackupStoreError, type BackupStore } from '../../providers/drive/googleDrive';

const reasonOf = (error: unknown): DriveBackupError =>
  error instanceof BackupStoreError ? error.reason : 'unavailable';

export interface DriveBackupDependencies {
  /** Null when no Drive permission is configured: the copy is off. */
  store: BackupStore | null;
  exportAll(): Promise<BackupFile>;
  now(): Date;
  onError(error: unknown, context: object): void;
}

/**
 * The automatic copy of the whole backup to the user's Google Drive. The free
 * server sleeps, so there is no clock: it is tried when the server wakes up
 * and every hour while it stays awake, and only writes when the copy in Drive
 * is older than DRIVE_BACKUP_INTERVAL_HOURS.
 */
export function createDriveBackup(deps: DriveBackupDependencies) {
  let running: Promise<DriveBackupStatus> | null = null;
  let lastSavedAt: Date | null = null;
  let lastError: DriveBackupError | null = null;

  const current = (): DriveBackupStatus => ({
    configured: deps.store !== null,
    lastSavedAt: lastSavedAt ? lastSavedAt.toISOString() : null,
    lastError,
  });

  async function attempt(store: BackupStore, force: boolean): Promise<DriveBackupStatus> {
    try {
      const stored = await store.lastSavedAt();
      const due = !stored || hoursBetween(stored, deps.now()) >= DRIVE_BACKUP_INTERVAL_HOURS;
      if (force || due) {
        await store.save(JSON.stringify(await deps.exportAll()));
        lastSavedAt = deps.now();
      } else {
        lastSavedAt = stored;
      }
      lastError = null;
    } catch (error) {
      lastError = reasonOf(error);
      deps.onError(error, { step: 'drive_backup' });
    }
    return current();
  }

  /** One attempt at a time: a second call while one runs gets the same answer. */
  function once(force: boolean): Promise<DriveBackupStatus> {
    const store = deps.store;
    if (!store) return Promise.resolve(current());
    running ??= attempt(store, force).finally(() => {
      running = null;
    });
    return running;
  }

  return {
    /** Writes the copy if the one in Drive is old enough. Never throws. */
    runIfDue: () => once(false),
    /** Writes the copy now, asked by the user. Never throws: the result says how it went. */
    runNow: () => once(true),

    /** What the data screen shows. Asks Drive when it is not known yet since the server woke up. */
    async status(): Promise<DriveBackupStatus> {
      // A copy on its way (the one tried on waking) answers with its own result.
      if (running) return running;
      if (!deps.store || lastSavedAt || lastError) return current();
      try {
        lastSavedAt = await deps.store.lastSavedAt();
      } catch (error) {
        lastError = reasonOf(error);
        deps.onError(error, { step: 'drive_status' });
      }
      return current();
    },
  };
}

export type DriveBackup = ReturnType<typeof createDriveBackup>;
