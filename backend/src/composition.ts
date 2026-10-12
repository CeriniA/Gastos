import { todayIso } from '@gastos/shared';
import type { Env } from './config/env';
import type { CollectionPort } from './core/db/collectionPort';
import { migrationsPort, runMigrations } from './core/db/migrations';
import { withTransaction } from './core/db/transaction';
import { logger } from './core/logger';
import { migrations } from './migrations';
import { accountsPort, accountsRepository } from './modules/accounts';
import { authStateRepository, createAuthService, type AuthService } from './modules/auth';
import { createBackupService, type BackupService } from './modules/backup';
import { cardPeriodsPort, cardPeriodsRepository } from './modules/card-periods';
import { categoriesPort, categoriesRepository } from './modules/categories';
import { categoryRulesPort, categoryRulesRepository } from './modules/category-rules';
import { documentsPort, documentsRepository } from './modules/documents';
import { exchangeRatesPort } from './modules/exchange-rates';
import { installmentPlansPort, installmentPlansRepository } from './modules/installment-plans';
import { institutionsPort, institutionsRepository } from './modules/institutions';
import { recurringsPort } from './modules/recurrings';
import { tagsPort, tagsRepository } from './modules/tags';
import { transactionsPort, transactionsRepository } from './modules/transactions';
import { createGeminiExtractor } from './providers/ai/gemini';
import { createOpenExchangeRates } from './providers/rates/openExchangeRates';
import { wireServices, type Services } from './wiring';

export interface Container extends Services {
  auth: AuthService;
  backup: BackupService;
}

/**
 * Every collection of the app. Registering a port here is what puts a
 * collection into the backup, the restore and the integrity check.
 */
const collectionPorts: readonly CollectionPort[] = [
  institutionsPort,
  accountsPort,
  categoriesPort,
  tagsPort,
  documentsPort,
  installmentPlansPort,
  cardPeriodsPort,
  recurringsPort,
  categoryRulesPort,
  exchangeRatesPort,
  transactionsPort,
  migrationsPort,
];

/**
 * The composition root for production: the real repositories, the real
 * database transactions and the configuration, handed to the wiring.
 */
export function createContainer(env: Env): Container {
  // The one line that decides which AI reads the documents.
  const extractor = env.GEMINI_API_KEY
    ? createGeminiExtractor({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL })
    : null;

  const services = wireServices(
    {
      accounts: accountsRepository,
      cardPeriods: cardPeriodsRepository,
      categories: categoriesRepository,
      categoryRules: categoryRulesRepository,
      documents: documentsRepository,
      installmentPlans: installmentPlansRepository,
      institutions: institutionsRepository,
      tags: tagsRepository,
      transactions: transactionsRepository,
    },
    {
      runInTransaction: withTransaction,
      today: () => todayIso(env.APP_TIMEZONE),
      now: () => new Date(),
      extractor,
      rates: createOpenExchangeRates(),
      schedule: (work) => {
        work().catch((error: unknown) => logger.error({ err: error }, 'Background work failed'));
      },
      onError: (error, context) => logger.warn({ err: error, ...context }, 'Document could not be read'),
    },
  );

  const auth = createAuthService(
    {
      username: env.AUTH_USERNAME,
      passwordHash: env.AUTH_PASSWORD_HASH,
      jwtSecret: env.JWT_SECRET,
      expiresDays: env.JWT_EXPIRES_DAYS,
    },
    authStateRepository,
  );

  const backup = createBackupService(
    collectionPorts,
    {
      afterRestore: async () => {
        await runMigrations(migrations);
      },
    },
    withTransaction,
  );

  return { ...services, auth, backup };
}
