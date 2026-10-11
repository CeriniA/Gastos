import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../core/errors/errors';
import { requireAuth } from '../../core/middleware/auth';
import { createAuthController } from './auth.controller';
import type { AuthService } from './auth.service';

export function createAuthRouter(service: AuthService): Router {
  const controller = createAuthController(service);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts')),
  });

  const router = Router();
  router.post('/login', loginLimiter, express.json({ limit: '10kb' }), controller.login);
  router.get('/me', requireAuth(service), controller.me);
  return router;
}
