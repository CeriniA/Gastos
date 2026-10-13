import jwt from 'jsonwebtoken';
import {
  objectIdSchema,
  type LoginInput,
  type LoginResult,
  type SessionInfo,
  type User,
} from '@gastos/shared';
import { UnauthorizedError } from '../../core/errors/errors';

const DAY_SECONDS = 24 * 60 * 60;
const SECOND_MS = 1000;

export interface AuthConfig {
  jwtSecret: string;
  expiresDays: number;
}

/** A user and the number their open sessions must carry to stay valid. */
interface KnownUser {
  user: User;
  sessionVersion: number;
}

/** What the sessions need to know about users. The users module answers it. */
export interface UserDirectory {
  authenticate(username: string, password: string): Promise<KnownUser | null>;
  findActive(userId: string): Promise<KnownUser | null>;
  closeSessions(userId: string): Promise<void>;
}

/**
 * Sessions: a signed token (JWT) that names the user and the version of their
 * sessions it was issued for. Closing a user's sessions raises that version,
 * so every token issued before stops being accepted at once.
 */
export function createAuthService(config: AuthConfig, users: UserDirectory) {
  return {
    async login(input: LoginInput): Promise<LoginResult> {
      const known = await users.authenticate(input.username, input.password);
      if (!known) throw new UnauthorizedError('INVALID_CREDENTIALS');

      const expiresInSeconds = config.expiresDays * DAY_SECONDS;
      const token = jwt.sign({ sub: known.user.id, sv: known.sessionVersion }, config.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: expiresInSeconds,
      });
      return { token, expiresAt: new Date(Date.now() + expiresInSeconds * SECOND_MS).toISOString() };
    },

    /** Who the token belongs to, or null when it is forged, expired or closed. */
    async verify(token: string): Promise<SessionInfo | null> {
      let payload: jwt.JwtPayload;
      try {
        const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
        if (typeof decoded === 'string' || !decoded.exp) return null;
        // Tokens from before users existed named the user, not their id.
        if (!objectIdSchema.safeParse(decoded.sub).success) return null;
        payload = decoded;
      } catch {
        return null;
      }
      const known = await users.findActive(payload.sub!);
      if (!known || payload.sv !== known.sessionVersion) return null;
      return {
        userId: known.user.id,
        username: known.user.username,
        role: known.user.role,
        expiresAt: new Date(payload.exp! * SECOND_MS).toISOString(),
      };
    },

    /** Signs the user out of every device, including the one that asks. */
    revokeAll(userId: string): Promise<void> {
      return users.closeSessions(userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
