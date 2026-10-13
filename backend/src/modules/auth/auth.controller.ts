import type { RequestHandler } from 'express';
import { loginSchema } from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import { sessionOf } from '../../core/middleware/auth';
import type { AuthService } from './auth.service';

export function createAuthController(service: AuthService) {
  const login: RequestHandler = async (req, res) => {
    ok(res, await service.login(parse(loginSchema, req.body)));
  };
  /** Who is signed in. Also lets the frontend check that its stored token is still valid. */
  const me: RequestHandler = (_req, res) => {
    ok(res, sessionOf(res));
  };
  const logoutAll: RequestHandler = async (_req, res) => {
    await service.revokeAll(sessionOf(res).userId);
    noContent(res);
  };
  return { login, me, logoutAll };
}
