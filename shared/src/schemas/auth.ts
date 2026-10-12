import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH } from '../constants';

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(MAX_USERNAME_LENGTH),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  token: string;
  expiresAt: string;
}

export interface SessionInfo {
  username: string;
  expiresAt: string;
}
