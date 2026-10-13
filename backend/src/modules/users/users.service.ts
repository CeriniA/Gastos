import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  nameKey,
  type PasswordChange,
  type User,
  type UserCreate,
  type UserRole,
  type UserUpdate,
} from '@gastos/shared';
import { ConflictError, DuplicateError, NotFoundError, fieldError } from '../../core/errors/errors';
import type { UserRecord, UsersRepository } from './users.repository';

/** bcrypt work factor: slow enough to resist guessing, fast enough for one login. */
export const PASSWORD_HASH_COST = 12;
/** Length of the throwaway secret a wrong username is compared against. */
const DECOY_BYTES = 32;

export interface UsersOptions {
  /** Tests lower it so they do not spend their time hashing. */
  hashCost?: number;
  /** Runs once a user exists: gives them the starting categories and accounts. */
  onCreated?: (user: User) => Promise<void>;
}

/** A user and the number their open sessions must carry to stay valid. */
export interface UserSession {
  user: User;
  sessionVersion: number;
}

function toUser(record: UserRecord): User {
  const { passwordHash: _hash, sessionVersion: _version, driveToken: _drive, ...user } = record;
  return user;
}

const toSession = (record: UserRecord): UserSession => ({
  user: toUser(record),
  sessionVersion: record.sessionVersion,
});

/**
 * Who can use the app and how they prove it. Passwords are only ever compared
 * and replaced here; nothing else sees a hash.
 */
export function createUsersService(repository: UsersRepository, options: UsersOptions = {}) {
  const hashCost = options.hashCost ?? PASSWORD_HASH_COST;
  // Compared against when the username does not exist, so a wrong username
  // takes as long as a wrong password and cannot be told apart by timing.
  const decoyHash = bcrypt.hashSync(randomBytes(DECOY_BYTES).toString('hex'), hashCost);

  async function find(id: string): Promise<UserRecord> {
    const user = await repository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async function add(username: string, passwordHash: string, role: UserRole): Promise<User> {
    const usernameKey = nameKey(username);
    if (await repository.findByUsernameKey(usernameKey)) throw new DuplicateError('User', 'username');
    return toUser(await repository.create({ username, usernameKey, passwordHash, role }));
  }

  /** A new password closes every session opened with the old one. */
  async function setPassword(id: string, password: string): Promise<void> {
    await repository.update(
      id,
      { passwordHash: await bcrypt.hash(password, hashCost) },
      { closeSessions: true },
    );
  }

  return {
    async list(): Promise<User[]> {
      return (await repository.findAll()).map(toUser);
    },

    async create(input: UserCreate): Promise<User> {
      const user = await add(input.username, await bcrypt.hash(input.password, hashCost), input.role);
      await options.onCreated?.(user);
      return user;
    },

    /**
     * The very first user, taken from the server's configuration so a new
     * installation (or one from before users existed) has somebody who can
     * sign in and create the rest. Does nothing once anybody exists.
     *
     * `onCreated` is not run for them: whoever starts the server does it once
     * the data that was already there has been made theirs.
     */
    async ensureFirst(admin: { username: string; passwordHash: string }): Promise<User | null> {
      if ((await repository.count()) > 0) return null;
      return add(admin.username, admin.passwordHash, 'admin');
    },

    /** What an admin does to a user: a new password, or whether they can sign in. */
    async update(id: string, changes: UserUpdate, actorId: string): Promise<User> {
      await find(id);
      if (changes.active === false && id === actorId) {
        throw new ConflictError('An admin cannot switch themselves off', { entity: 'User' });
      }
      if (changes.password !== undefined) await setPassword(id, changes.password);
      if (changes.active !== undefined) {
        // Switching a user off also throws out whoever is signed in as them.
        await repository.update(id, { active: changes.active }, { closeSessions: !changes.active });
      }
      return toUser(await find(id));
    },

    async changePassword(id: string, input: PasswordChange): Promise<void> {
      const user = await find(id);
      if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
        throw fieldError('currentPassword', 'Wrong password');
      }
      await setPassword(id, input.newPassword);
    },

    /** Whose credentials those are, or null. An inactive user is refused like a wrong password. */
    async authenticate(username: string, password: string): Promise<UserSession | null> {
      const user = await repository.findByUsernameKey(nameKey(username));
      const matches = await bcrypt.compare(password, user?.passwordHash ?? decoyHash);
      return user && matches && user.active ? toSession(user) : null;
    },

    /** The user a session belongs to, if they can still use the app. */
    async findActive(id: string): Promise<UserSession | null> {
      const user = await repository.findById(id);
      return user?.active ? toSession(user) : null;
    },

    /** Signs the user out of every device, including the one that asks. */
    async closeSessions(id: string): Promise<void> {
      await repository.update(id, {}, { closeSessions: true });
    },

    /** The user's sealed permission to write in their Drive, or null. */
    async driveToken(id: string): Promise<string | null> {
      return (await repository.findById(id))?.driveToken ?? null;
    },

    async setDriveToken(id: string, driveToken: string | null): Promise<void> {
      await repository.update(id, { driveToken });
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
