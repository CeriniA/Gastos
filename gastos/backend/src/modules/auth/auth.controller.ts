import type { RequestHandler } from 'express';
import { loginSchema } from '@gastos/shared';
import { ok, parse } from '../../core/http/http';
import type { AuthService } from './auth.service';

export function createAuthController(service: AuthService) {
  const login: RequestHandler = async (req, res) => {
    ok(res, await service.login(parse(loginSchema, req.body)));
  };
  /** Lets the frontend check that its stored token is still valid. */
  const me: RequestHandler = (_req, res) => {
    ok(res, res.locals.session);
  };
  return { login, me };
}
