import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../core/errors/errors';
import { requireAuth } from '../../core/middleware/auth';
import { createAuthController } from './auth.controller';
import type { AuthService } from './auth.service';

/** Ten wrong passwords in fifteen minutes and the login waits: enough for typos, too slow for guessing. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 10;

export function createAuthRouter(service: AuthService): Router {
  const controller = createAuthController(service);
  const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_ATTEMPTS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts')),
  });

  const router = Router();
  router.post('/login', loginLimiter, express.json({ limit: '10kb' }), controller.login);
  router.get('/me', requireAuth(service), controller.me);
  router.post('/logout-all', requireAuth(service), controller.logoutAll);
  return router;
}
