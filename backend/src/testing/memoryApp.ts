import type { Container } from '../composition';
import type { Env } from '../config/env';
import type { CollectionPort } from '../core/db/collectionPort';
import { createAuthService } from '../modules/auth';
import { createBackupService, createDriveBackup } from '../modules/backup';
import { createMemoryBackend } from './memory';

/**
 * Everything `createApp` needs, over the in-memory backend: the HTTP tests and
 * the demo server run the real routes, controllers and services without a
 * database. The backup works on the arrays in memory, so a file exported here
 * can only be restored here.
 */
export function createMemoryContainer(env: Env, today?: string) {
  const backend = createMemoryBackend(today);
  const { store } = backend;

  const ports: CollectionPort[] = (Object.keys(store) as (keyof typeof store)[]).map((name) => ({
    name,
    references: [],
    dump: async () => structuredClone(store[name]),
    replaceAll: async (documents) => {
      store[name] = structuredClone(documents) as never;
      return documents.length;
    },
    // The services already keep references whole; there is no second copy to compare against.
    findBrokenReferences: async () => [],
  }));

  let sessionsClosedAt: Date | null = null;
  const auth = createAuthService(
    {
      username: env.AUTH_USERNAME,
      passwordHash: env.AUTH_PASSWORD_HASH,
      jwtSecret: env.JWT_SECRET,
      expiresDays: env.JWT_EXPIRES_DAYS,
    },
    {
      load: async () => sessionsClosedAt,
      save: async (moment) => {
        sessionsClosedAt = moment;
      },
    },
  );
  const backup = createBackupService(
    ports,
    { afterRestore: async () => undefined },
    backend.runInTransaction,
  );
  const driveBackup = createDriveBackup({
    store: null,
    exportAll: () => backup.exportAll(),
    now: () => backend.clock.now,
    onError: () => undefined,
  });

  const container: Container = { ...backend, auth, backup, driveBackup };
  return { container, backend };
}
