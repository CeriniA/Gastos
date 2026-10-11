import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { API_PREFIX } from '@gastos/shared';
import type { Container } from './composition';
import type { Env } from './config/env';
import { isDatabaseUp } from './core/db/connection';
import { ok } from './core/http/http';
import { logger } from './core/logger';
import { requireAuth } from './core/middleware/auth';
import { errorHandler, notFoundHandler } from './core/middleware/errorHandler';
import { createAccountsRouter } from './modules/accounts';
import { createAuthRouter } from './modules/auth';
import { createBackupRouter } from './modules/backup';
import { createCategoriesRouter } from './modules/categories';
import { createSpreadsheetRouter } from './modules/spreadsheet';
import { createTagsRouter } from './modules/tags';
import { createTransactionsRouter } from './modules/transactions';

export function createApp(container: Container, env: Env): Express {
  const app = express();
  app.set('trust proxy', 1); // Render sits in front of the service.
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => String(req.headers['x-request-id'] ?? randomUUID()),
      autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, exposedHeaders: ['Content-Disposition'] }));

  const api = Router();

  // Public. Render's health check and the frontend's "waking up" screen use it.
  api.get('/health', (_req, res) => {
    ok(res, { status: 'ok', database: isDatabaseUp() ? 'up' : 'down' });
  });
  api.use('/auth', createAuthRouter(container.auth));

  // Everything below needs a valid token.
  api.use(requireAuth(container.auth));

  // Request bodies are parsed after authentication. Routes that accept large
  // bodies (backup restore, import) declare their own parser and limit.
  const json = express.json({ limit: '200kb' });
  api.use('/accounts', json, createAccountsRouter(container.accounts));
  api.use('/categories', json, createCategoriesRouter(container.categories));
  api.use('/tags', json, createTagsRouter(container.tags));
  api.use('/transactions', json, createTransactionsRouter(container.transactions));
  api.use('/backup', createBackupRouter(container.backup));
  api.use('/spreadsheet', createSpreadsheetRouter(container.spreadsheet));

  app.use(API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
