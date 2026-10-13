import type { User, UserRole } from '@gastos/shared';
import { toObjectId } from '../../core/db/ids';
import { UserModel, type UserDoc } from './users.model';

/** A user with what only the server may see. */
export interface UserRecord extends User {
  passwordHash: string;
  sessionVersion: number;
  driveToken: string | null;
}

export type UserChanges = Partial<Pick<UserRecord, 'passwordHash' | 'active' | 'driveToken'>>;

function toRecord(doc: UserDoc): UserRecord {
  return {
    id: doc._id.toString(),
    username: doc.username,
    role: doc.role,
    active: doc.active,
    createdAt: doc.createdAt.toISOString(),
    passwordHash: doc.passwordHash,
    sessionVersion: doc.sessionVersion ?? 0,
    driveToken: doc.driveToken ?? null,
  };
}

export const usersRepository = {
  /** Oldest first: the first one is whoever set the app up. */
  async findAll(): Promise<UserRecord[]> {
    const docs = await UserModel.find().sort({ createdAt: 1 }).lean<UserDoc[]>();
    return docs.map(toRecord);
  },

  async findById(id: string): Promise<UserRecord | null> {
    const doc = await UserModel.findById(toObjectId(id)).lean<UserDoc>();
    return doc ? toRecord(doc) : null;
  },

  async findByUsernameKey(usernameKey: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ usernameKey }).lean<UserDoc>();
    return doc ? toRecord(doc) : null;
  },

  count(): Promise<number> {
    return UserModel.countDocuments();
  },

  async create(data: {
    username: string;
    usernameKey: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<UserRecord> {
    const doc = await UserModel.create(data);
    return toRecord(doc.toObject() as UserDoc);
  },

  /** `closeSessions` also invalidates every token issued so far. */
  async update(
    id: string,
    changes: UserChanges,
    options: { closeSessions?: boolean } = {},
  ): Promise<UserRecord | null> {
    const doc = await UserModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: changes, ...(options.closeSessions ? { $inc: { sessionVersion: 1 } } : {}) },
      { new: true },
    ).lean<UserDoc>();
    return doc ? toRecord(doc) : null;
  },
};

export type UsersRepository = typeof usersRepository;
