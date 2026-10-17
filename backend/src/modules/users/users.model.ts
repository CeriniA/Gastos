import { Schema, model } from 'mongoose';
import { USER_ROLES, type UserRole } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

/** How many documents a user sent to the AI on one calendar day. */
export interface AiUsage {
  day: string;
  count: number;
}

/**
 * Who can sign in. The one collection that is not anybody's data: it has no
 * owner and no backup port, so passwords and permissions never travel in a
 * backup and restoring one cannot bring a closed session back to life.
 */
export interface UserDoc {
  _id: ObjectId;
  username: string;
  /** Normalised name; the unique index lives here. */
  usernameKey: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  /** Goes up to close every open session: a token carries the number it was issued with. */
  sessionVersion: number;
  /** The permission to write in the user's Google Drive, sealed. Null while not connected. */
  driveToken: string | null;
  /** Documents they may send to the AI per day. Null: the installation's default. */
  aiDailyLimit: number | null;
  /** Only the current day is kept: a new day starts the count again. */
  aiUsage: AiUsage | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, trim: true },
    usernameKey: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: [...USER_ROLES] },
    active: { type: Boolean, required: true, default: true },
    sessionVersion: { type: Number, required: true, default: 0 },
    driveToken: { type: String, default: null },
    aiDailyLimit: { type: Number, default: null, min: 0 },
    aiUsage: {
      type: new Schema<AiUsage>({ day: String, count: Number }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true },
);

export const UserModel = model<UserDoc>('User', schema, COLLECTIONS.users);
