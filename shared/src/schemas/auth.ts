import { z } from 'zod';
import {
  MAX_AI_DAILY_READINGS,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  USER_ROLES,
  type UserRole,
} from '../constants';

const usernameSchema = z.string().trim().min(1).max(MAX_USERNAME_LENGTH);
/** A password being set. One being checked (login) may be older than the minimum length. */
const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'Password is too short')
  .max(MAX_PASSWORD_LENGTH);
const typedPasswordSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);

export const loginSchema = z.object({ username: usernameSchema, password: typedPasswordSchema });
export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  token: string;
  expiresAt: string;
}

/** Who a valid token belongs to. */
export interface SessionInfo {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: string;
}

/** A user as the admin screen shows it. The password never leaves the server. */
export interface User {
  id: string;
  username: string;
  role: UserRole;
  /** An inactive user cannot sign in; their data stays. */
  active: boolean;
  /** Documents they can send to the AI per day. Null: the installation's default. */
  aiDailyLimit: number | null;
  /** What they can send today: their own limit, or the installation's default. */
  aiLimit: number;
  /** Documents sent to the AI today. */
  aiReadingsToday: number;
  createdAt: string;
}

export const userCreateSchema = z.object({
  username: usernameSchema,
  password: newPasswordSchema,
  role: z.enum(USER_ROLES).default('user'),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

/**
 * What an admin can change on a user: their name, their type, a new password,
 * whether they can sign in and how many documents they send to the AI a day.
 */
export const userUpdateSchema = z
  .object({
    username: usernameSchema,
    role: z.enum(USER_ROLES),
    password: newPasswordSchema,
    active: z.boolean(),
    aiDailyLimit: z.number().int().min(0).max(MAX_AI_DAILY_READINGS).nullable(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to change' });
export type UserUpdate = z.infer<typeof userUpdateSchema>;

/** A user changing their own password proves they know the current one. */
export const passwordChangeSchema = z.object({
  currentPassword: typedPasswordSchema,
  newPassword: newPasswordSchema,
});
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
