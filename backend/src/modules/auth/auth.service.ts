import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginInput, LoginResult, SessionInfo } from '@gastos/shared';
import { UnauthorizedError } from '../../core/errors/errors';

export interface AuthConfig {
  username: string;
  passwordHash: string;
  jwtSecret: string;
  expiresDays: number;
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Where the moment of the last "sign out everywhere" is remembered. */
export interface AuthStateStore {
  load(): Promise<Date | null>;
  save(sessionsValidFrom: Date): Promise<void>;
}

/**
 * Single-user authentication. The user and the bcrypt hash of the password
 * live in environment variables; there is no users collection.
 */
export function createAuthService(config: AuthConfig, state: AuthStateStore) {
  // Kept in memory so checking a token never waits for the database.
  // In seconds, like the "issued at" of a token.
  let validFromSeconds = 0;
  const remember = (moment: Date | null) => {
    validFromSeconds = moment ? Math.ceil(moment.getTime() / 1000) : 0;
  };

  return {
    /** Reads the stored state. Called at startup and after a restore. */
    async init(): Promise<void> {
      remember(await state.load());
    },

    /**
     * Signs out every device: no session started before now is accepted
     * again, including the one that asked for it.
     */
    async revokeAll(now: Date = new Date()): Promise<void> {
      await state.save(now);
      remember(now);
    },

    async login(input: LoginInput): Promise<LoginResult> {
      // Always run the hash comparison so a wrong username takes as long as a wrong password.
      const passwordOk = await bcrypt.compare(input.password, config.passwordHash);
      const usernameOk = sameText(input.username, config.username);
      if (!passwordOk || !usernameOk) throw new UnauthorizedError('INVALID_CREDENTIALS');

      const expiresInSeconds = config.expiresDays * 24 * 60 * 60;
      const token = jwt.sign({ sub: config.username }, config.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: expiresInSeconds,
      });
      return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
    },

    verify(token: string): SessionInfo | null {
      try {
        const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
        if (typeof payload === 'string' || payload.sub !== config.username || !payload.exp) return null;
        if (!payload.iat || payload.iat < validFromSeconds) return null;
        return { username: config.username, expiresAt: new Date(payload.exp * 1000).toISOString() };
      } catch {
        return null;
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
