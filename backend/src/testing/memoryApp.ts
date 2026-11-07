import type { Env } from '../config/env';
import { buildContainer } from '../container';
import type { CollectionPort } from '../core/db/collectionPort';
import { currentUserId } from '../core/context/owner';
import { OBJECT_ID_LENGTH } from '../core/db/ids';
import { createAiAllowance } from '../modules/users/aiAllowance';
import { type UserRecord, type UsersRepository } from '../modules/users/users.repository';
import type { BackupStoreProvider } from '../providers/drive/googleDrive';
import { createMemoryBackend, type MemoryBackendOptions } from './memory';

/** Hashing as slow as production would make the HTTP tests spend their time on it. */
const FAST_HASH_COST = 4;
const STAMP = '2026-10-01T00:00:00.000Z';

/** Users kept in an array, like the rest of the in-memory backend. */
export function createMemoryUsers(): UsersRepository {
  const users: (UserRecord & { usernameKey: string })[] = [];
  const idOf = (position: number) => (position + 1).toString(16).padStart(OBJECT_ID_LENGTH, 'a');
  return {
    findAll: async () => [...users],
    findById: async (id) => users.find((user) => user.id === id) ?? null,
    findByUsernameKey: async (usernameKey) => users.find((user) => user.usernameKey === usernameKey) ?? null,
    count: async () => users.length,
    async create(data) {
      const user = {
        id: idOf(users.length),
        username: data.username,
        usernameKey: data.usernameKey,
        role: data.role,
        active: true,
        aiDailyLimit: null,
        createdAt: STAMP,
        passwordHash: data.passwordHash,
        sessionVersion: 0,
        driveToken: null,
        aiUsage: null,
      };
      users.push(user);
      return { ...user };
    },
    async update(id, changes, options = {}) {
      const user = users.find((candidate) => candidate.id === id);
      if (!user) return null;
      Object.assign(user, changes);
      if (options.closeSessions) user.sessionVersion += 1;
      return { ...user };
    },
    async takeAiReading(id, day, limit) {
      const user = users.find((candidate) => candidate.id === id);
      if (!user || limit <= 0) return false;
      const count = user.aiUsage?.day === day ? user.aiUsage.count : 0;
      if (count >= limit) return false;
      user.aiUsage = { day, count: count + 1 };
      return true;
    },
  };
}

export interface MemoryContainerOptions extends MemoryBackendOptions {
  /** A pretend Google, to try connecting a Drive. Without it, Drive is off. */
  driveProvider?: BackupStoreProvider;
}

/**
 * Everything `createApp` needs, over the in-memory backend: the HTTP tests and
 * the demo server run the real routes, controllers and services without a
 * database, users and sessions included. Like the database, it refuses to
 * touch data unless the code runs as a user. The backup works on the arrays in
 * memory, so a file exported here can only be restored here.
 */
export function createMemoryContainer(env: Env, today?: string, options: MemoryContainerOptions = {}) {
  const usersRepository = createMemoryUsers();
  // The calendar is the backend's, which is built next: asked only once a document is uploaded.
  const aiAllowance = createAiAllowance(usersRepository, {
    today: () => backend.calendar.today,
    dailyReadings: env.AI_DAILY_READINGS,
  });
  const backend = createMemoryBackend(today, {
    ...options,
    requireUser: true,
    takeAiReading: () => aiAllowance.take(currentUserId()),
  });
  const { store } = backend;

  const collectionPorts: CollectionPort[] = (Object.keys(backend.emptyStore()) as (keyof typeof store)[]).map(
    (name) => ({
      name,
      references: [],
      shared: false,
      dump: async () => structuredClone(store[name]),
      replaceAll: async (documents) => {
        store[name] = structuredClone(documents) as never;
        return documents.length;
      },
      // The services already keep references whole; there is no second copy to compare against.
      findBrokenReferences: async () => [],
    }),
  );

  const container = buildContainer({
    services: backend,
    usersRepository,
    collectionPorts,
    runInTransaction: backend.runInTransaction,
    driveProvider: options.driveProvider ?? null,
    afterRestore: async () => undefined,
    now: () => backend.clock.now,
    onError: (error, context) => backend.errors.push({ error, context }),
    secret: env.JWT_SECRET,
    sessionDays: env.JWT_EXPIRES_DAYS,
    passwordHashCost: FAST_HASH_COST,
    aiAllowance,
  });
  return { container, backend };
}
