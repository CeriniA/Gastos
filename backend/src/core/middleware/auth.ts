import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/errors';

export interface TokenVerifier {
  verify(token: string): { username: string; expiresAt: string } | null;
}

/** Rejects any request without a valid `Authorization: Bearer <token>` header. */
export function requireAuth(verifier: TokenVerifier): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const session = token ? verifier.verify(token) : null;
    if (!session) {
      next(new UnauthorizedError());
      return;
    }
    res.locals.session = session;
    next();
  };
}
