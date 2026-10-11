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

/**
 * Single-user authentication. The user and the bcrypt hash of the password
 * live in environment variables; there is no users collection.
 */
export function createAuthService(config: AuthConfig) {
  return {
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
        return { username: config.username, expiresAt: new Date(payload.exp * 1000).toISOString() };
      } catch {
        return null;
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
