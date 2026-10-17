import type { User, UserRole } from '@gastos/shared';
import { toObjectId } from '../../core/db/ids';
import { UserModel, type AiUsage, type UserDoc } from './users.model';

/** A user with what only the server may see. */
export interface UserRecord extends Omit<User, 'aiLimit' | 'aiReadingsToday'> {
  passwordHash: string;
  sessionVersion: number;
  driveToken: string | null;
  aiUsage: AiUsage | null;
}

export type UserChanges = Partial<
  Pick<UserRecord, 'username' | 'role' | 'passwordHash' | 'active' | 'driveToken' | 'aiDailyLimit'> & {
    usernameKey: string;
  }
>;

function toRecord(doc: UserDoc): UserRecord {
  return {
    id: doc._id.toString(),
    username: doc.username,
    role: doc.role,
    active: doc.active,
    // Stored before the limit existed means the installation's default.
    aiDailyLimit: doc.aiDailyLimit ?? null,
    createdAt: doc.createdAt.toISOString(),
    passwordHash: doc.passwordHash,
    sessionVersion: doc.sessionVersion ?? 0,
    driveToken: doc.driveToken ?? null,
    aiUsage: doc.aiUsage ? { day: doc.aiUsage.day, count: doc.aiUsage.count } : null,
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

  /**
   * Counts one more document sent to the AI on `day`, unless the user already
   * sent `limit`. Each step is a single conditional write, so two uploads at
   * the same moment cannot both take the last one. Returns whether it counted.
   */
  async takeAiReading(id: string, day: string, limit: number): Promise<boolean> {
    if (limit <= 0) return false;
    const _id = toObjectId(id);
    const sameDay = await UserModel.updateOne(
      { _id, 'aiUsage.day': day, 'aiUsage.count': { $lt: limit } },
      { $inc: { 'aiUsage.count': 1 } },
    );
    if (sameDay.modifiedCount === 1) return true;
    const newDay = await UserModel.updateOne(
      { _id, 'aiUsage.day': { $ne: day } },
      { $set: { aiUsage: { day, count: 1 } } },
    );
    return newDay.modifiedCount === 1;
  },
};

export type UsersRepository = typeof usersRepository;
