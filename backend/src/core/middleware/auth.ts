import type { RequestHandler, Response } from 'express';
import type { SessionInfo } from '@gastos/shared';
import { ForbiddenError, UnauthorizedError } from '../errors/errors';

const BEARER = 'Bearer ';

export interface TokenVerifier {
  verify(token: string): Promise<SessionInfo | null>;
}

/** Rejects any request without a valid `Authorization: Bearer <token>` header. */
export function requireAuth(verifier: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith(BEARER) ? header.slice(BEARER.length) : '';
    const session = token ? await verifier.verify(token) : null;
    if (!session) throw new UnauthorizedError();
    res.locals.session = session;
    next();
  };
}

/** Who is asking. Only meaningful after `requireAuth`. */
export function sessionOf(res: Response): SessionInfo {
  const session = res.locals.session as SessionInfo | undefined;
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Lets only an admin through. Goes after `requireAuth`. */
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (sessionOf(res).role !== 'admin') throw new ForbiddenError();
  next();
};
