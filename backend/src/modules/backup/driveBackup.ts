import {
  DRIVE_BACKUP_INTERVAL_HOURS,
  hoursBetween,
  type BackupFile,
  type DriveBackupError,
  type DriveBackupStatus,
} from '@gastos/shared';
import { ConflictError } from '../../core/errors/errors';
import {
  BackupStoreError,
  type BackupStore,
  type BackupStoreProvider,
} from '../../providers/drive/googleDrive';

const reasonOf = (error: unknown): DriveBackupError =>
  error instanceof BackupStoreError ? error.reason : 'unavailable';

/** The running user's link to their own Drive. */
export interface DriveAccount {
  /** Tells users apart, for what is remembered while the server is awake. */
  id(): string;
  /** The permission the user granted, or null while they have not connected a Drive. */
  permission(): Promise<string | null>;
  setPermission(permission: string | null): Promise<void>;
}

export interface DriveBackupDependencies {
  /** Null when the server has no Google credentials: nobody can connect a Drive. */
  provider: BackupStoreProvider | null;
  account: DriveAccount;
  /** Writes and reads the note that travels to Google and back, saying who is connecting. */
  tickets: { issue(userId: string): string; read(ticket: string): string | null };
  exportAll(): Promise<BackupFile>;
  now(): Date;
  onError(error: unknown, context: object): void;
}

/** What is known about one user's copy since the server woke up. */
interface Known {
  running: Promise<DriveBackupStatus> | null;
  lastSavedAt: Date | null;
  lastError: DriveBackupError | null;
}

/**
 * The automatic copy of each user's backup to their own Google Drive. The free
 * server sleeps, so there is no clock: it is tried when the server wakes up
 * and every hour while it stays awake, and only writes when the copy in Drive
 * is older than DRIVE_BACKUP_INTERVAL_HOURS.
 *
 * Everything here is about the running user: their permission, their copy.
 */
export function createDriveBackup(deps: DriveBackupDependencies) {
  const known = new Map<string, Known>();

  function mine(): Known {
    const id = deps.account.id();
    const state = known.get(id) ?? { running: null, lastSavedAt: null, lastError: null };
    known.set(id, state);
    return state;
  }

  /** The user's store, or null while Drive is off or they have not connected one. */
  async function openStore(): Promise<BackupStore | null> {
    const permission = deps.provider ? await deps.account.permission() : null;
    return deps.provider && permission ? deps.provider.open(permission) : null;
  }

  const report = (state: Known, connected: boolean): DriveBackupStatus => ({
    available: deps.provider !== null,
    connected,
    lastSavedAt: state.lastSavedAt ? state.lastSavedAt.toISOString() : null,
    lastError: state.lastError,
  });

  async function attempt(state: Known, store: BackupStore, force: boolean): Promise<DriveBackupStatus> {
    try {
      const stored = await store.lastSavedAt();
      const due = !stored || hoursBetween(stored, deps.now()) >= DRIVE_BACKUP_INTERVAL_HOURS;
      if (force || due) {
        await store.save(JSON.stringify(await deps.exportAll()));
        state.lastSavedAt = deps.now();
      } else {
        state.lastSavedAt = stored;
      }
      state.lastError = null;
    } catch (error) {
      state.lastError = reasonOf(error);
      deps.onError(error, { step: 'drive_backup' });
    }
    return report(state, true);
  }

  /** One attempt at a time per user: a second call while one runs gets the same answer. */
  async function once(force: boolean): Promise<DriveBackupStatus> {
    const state = mine();
    if (state.running) return state.running;
    const store = await openStore();
    if (!store) return report(state, false);
    state.running ??= attempt(state, store, force).finally(() => {
      state.running = null;
    });
    return state.running;
  }

  return {
    /** Writes the copy if the one in Drive is old enough. Never throws. */
    runIfDue: () => once(false),
    /** Writes the copy now, asked by the user. Never throws: the result says how it went. */
    runNow: () => once(true),

    /** What the data screen shows. Asks Drive when it is not known yet since the server woke up. */
    async status(): Promise<DriveBackupStatus> {
      const state = mine();
      // A copy on its way (the one tried on waking) answers with its own result.
      if (state.running) return state.running;
      const store = await openStore();
      if (!store) return report(state, false);
      if (!state.lastSavedAt && !state.lastError) {
        try {
          state.lastSavedAt = await store.lastSavedAt();
        } catch (error) {
          state.lastError = reasonOf(error);
          deps.onError(error, { step: 'drive_status' });
        }
      }
      return report(state, true);
    },

    /** Where the user goes to let the app write in their Drive. */
    connectUrl(): string {
      if (!deps.provider) throw new ConflictError('Google Drive is not set up on this server');
      return deps.provider.consentUrl(deps.tickets.issue(deps.account.id()));
    },

    /** The user Google is sending back, or null when the ticket is not one of ours. */
    whoIsBack(ticket: string): string | null {
      return deps.tickets.read(ticket);
    },

    /** Keeps the permission Google just granted and writes the first copy. */
    async connect(code: string): Promise<DriveBackupStatus> {
      if (!deps.provider) throw new ConflictError('Google Drive is not set up on this server');
      await deps.account.setPermission(await deps.provider.redeem(code));
      known.delete(deps.account.id());
      return once(false);
    },

    /** Forgets the permission. The copies already in Drive stay there. */
    async disconnect(): Promise<DriveBackupStatus> {
      await deps.account.setPermission(null);
      known.delete(deps.account.id());
      return report(mine(), false);
    },
  };
}

export type DriveBackup = ReturnType<typeof createDriveBackup>;
