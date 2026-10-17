import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_AI_DAILY_READINGS,
  DEFAULT_TIMEZONE,
  nameKey,
  todayIso,
  type IsoDate,
  type PasswordChange,
  type User,
  type UserCreate,
  type UserRole,
  type UserUpdate,
} from '@gastos/shared';
import {
  AiLimitError,
  ConflictError,
  DuplicateError,
  NotFoundError,
  fieldError,
} from '../../core/errors/errors';
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
  /** Today's calendar day: the AI limit counts per day. */
  today?: () => IsoDate;
  /** Documents a user can send to the AI per day when the admin gave them no limit of their own. */
  aiDailyReadings?: number;
}

/** A user and the number their open sessions must carry to stay valid. */
export interface UserSession {
  user: User;
  sessionVersion: number;
}

/**
 * Who can use the app and how they prove it. Passwords are only ever compared
 * and replaced here; nothing else sees a hash.
 */
export function createUsersService(repository: UsersRepository, options: UsersOptions = {}) {
  const hashCost = options.hashCost ?? PASSWORD_HASH_COST;
  const today = options.today ?? (() => todayIso(DEFAULT_TIMEZONE));
  const defaultLimit = options.aiDailyReadings ?? DEFAULT_AI_DAILY_READINGS;
  // Compared against when the username does not exist, so a wrong username
  // takes as long as a wrong password and cannot be told apart by timing.
  const decoyHash = bcrypt.hashSync(randomBytes(DECOY_BYTES).toString('hex'), hashCost);

  function toUser(record: UserRecord): User {
    const { passwordHash: _hash, sessionVersion: _version, driveToken: _drive, aiUsage, ...user } = record;
    return {
      ...user,
      aiLimit: user.aiDailyLimit ?? defaultLimit,
      aiReadingsToday: aiUsage?.day === today() ? aiUsage.count : 0,
    };
  }

  const toSession = (record: UserRecord): UserSession => ({
    user: toUser(record),
    sessionVersion: record.sessionVersion,
  });

  async function find(id: string): Promise<UserRecord> {
    const user = await repository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  /** The normalised name, refused when somebody else already has it. */
  async function freeUsernameKey(username: string, ownId?: string): Promise<string> {
    const usernameKey = nameKey(username);
    const holder = await repository.findByUsernameKey(usernameKey);
    if (holder && holder.id !== ownId) throw new DuplicateError('User', 'username');
    return usernameKey;
  }

  async function add(username: string, passwordHash: string, role: UserRole): Promise<User> {
    const usernameKey = await freeUsernameKey(username);
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

    /**
     * What an admin does to a user: a new name or type, a new password,
     * whether they can sign in, their daily AI limit. An admin can neither
     * switch themselves off nor stop being one, so an admin is always left.
     */
    async update(id: string, changes: UserUpdate, actorId: string): Promise<User> {
      const user = await find(id);
      if (changes.active === false && id === actorId) {
        throw new ConflictError('An admin cannot switch themselves off', { entity: 'User' });
      }
      if (changes.role !== undefined && changes.role !== user.role && id === actorId) {
        throw new ConflictError('An admin cannot change their own type', { entity: 'User' });
      }
      const { username, role, aiDailyLimit, active, password } = changes;
      const usernameKey = username === undefined ? undefined : await freeUsernameKey(username, id);
      if (password !== undefined) await setPassword(id, password);
      await repository.update(
        id,
        {
          ...(username === undefined ? {} : { username, usernameKey }),
          ...(role === undefined ? {} : { role }),
          ...(aiDailyLimit === undefined ? {} : { aiDailyLimit }),
          ...(active === undefined ? {} : { active }),
        },
        // Switching a user off also throws out whoever is signed in as them.
        { closeSessions: active === false },
      );
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

    /** Counts one document sent to the AI today, or refuses once the user reached their limit. */
    async takeAiReading(id: string): Promise<void> {
      const limit = (await find(id)).aiDailyLimit ?? defaultLimit;
      if (!(await repository.takeAiReading(id, today(), limit))) throw new AiLimitError(limit);
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
