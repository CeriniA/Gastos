import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { API_PREFIX, DATA_SCREEN_PATH } from '@gastos/shared';
import type { Env } from './config/env';
import type { Container } from './container';
import { isDatabaseUp } from './core/db/connection';
import { ok } from './core/http/http';
import { logger } from './core/logger';
import { requireAuth } from './core/middleware/auth';
import { errorHandler, notFoundHandler } from './core/middleware/errorHandler';
import { createAccountsRouter } from './modules/accounts';
import { createAuthRouter } from './modules/auth';
import { DRIVE_CALLBACK_ROUTE, createBackupRouter, createDriveCallback } from './modules/backup';
import { createCardPeriodsRouter } from './modules/card-periods';
import { createCategoriesRouter } from './modules/categories';
import { createCategoryRulesRouter } from './modules/category-rules';
import { createConsumptionRouter } from './modules/consumption';
import { createDocumentsRouter } from './modules/documents';
import { createExchangeRatesRouter } from './modules/exchange-rates';
import { createInstallmentPlansRouter } from './modules/installment-plans';
import { createInstitutionsRouter } from './modules/institutions';
import { createProductRulesRouter } from './modules/product-rules';
import { createRecurringsRouter } from './modules/recurrings';
import { createReportsRouter } from './modules/reports';
import { createSpreadsheetRouter } from './modules/spreadsheet';
import { createTagsRouter } from './modules/tags';
import { createTransactionsRouter } from './modules/transactions';
import { createUsersRouter } from './modules/users';

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
  // Google sends the browser here after a user answers: a page load, with no token.
  api.get(
    DRIVE_CALLBACK_ROUTE,
    createDriveCallback(container.driveBackup, `${env.CORS_ORIGIN[0]}${DATA_SCREEN_PATH}`),
  );

  // Everything below needs a valid token. Each controller then runs as the
  // user of that token (`asUser`), so the data it reaches is theirs.
  api.use(requireAuth(container.auth));

  // Request bodies are parsed after authentication. Routes that accept large
  // bodies (backup restore, import) declare their own parser and limit.
  const json = express.json({ limit: '200kb' });
  api.use('/users', json, createUsersRouter(container.users));
  api.use('/accounts', json, createAccountsRouter(container.accounts));
  api.use('/card-periods', json, createCardPeriodsRouter(container.cardPeriods));
  api.use('/installment-plans', json, createInstallmentPlansRouter(container.installmentPlans));
  api.use('/institutions', json, createInstitutionsRouter(container.institutions));
  api.use('/categories', json, createCategoriesRouter(container.categories));
  api.use('/tags', json, createTagsRouter(container.tags));
  api.use('/transactions', json, createTransactionsRouter(container.transactions));
  api.use('/category-rules', json, createCategoryRulesRouter(container.categoryRules));
  api.use('/product-rules', createProductRulesRouter(container.productRules));
  api.use('/consumption', createConsumptionRouter(container.consumption));
  api.use('/reports', createReportsRouter(container.reports));
  api.use('/documents', createDocumentsRouter(container.documents));
  api.use('/exchange-rates', json, createExchangeRatesRouter(container.exchangeRates));
  api.use('/recurrings', json, createRecurringsRouter(container.recurrings));
  api.use('/backup', createBackupRouter(container.backup, container.driveBackup));
  api.use('/spreadsheet', createSpreadsheetRouter(container.spreadsheet));

  app.use(API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
