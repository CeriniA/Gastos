import { API_PREFIX, todayIso } from '@gastos/shared';
import type { Env } from './config/env';
import { buildContainer, type Container } from './container';
import { currentUserId } from './core/context/owner';
import type { CollectionPort } from './core/db/collectionPort';
import { migrationsPort, runMissingMigrations } from './core/db/migrations';
import { withTransaction } from './core/db/transaction';
import { logger } from './core/logger';
import { migrations } from './migrations';
import { accountsPort, accountsRepository } from './modules/accounts/accounts.repository';
import { DRIVE_CALLBACK_ROUTE } from './modules/backup/backup.routes';
import { cardPeriodsPort, cardPeriodsRepository } from './modules/card-periods/cardPeriods.repository';
import { categoriesPort, categoriesRepository } from './modules/categories/categories.repository';
import { categoryRulesPort, categoryRulesRepository } from './modules/category-rules/categoryRules.repository';
import { documentsPort, documentsRepository } from './modules/documents/documents.repository';
import { exchangeRatesPort, exchangeRatesRepository } from './modules/exchange-rates/exchangeRates.repository';
import { installmentPlansPort, installmentPlansRepository } from './modules/installment-plans/installmentPlans.repository';
import { institutionsPort, institutionsRepository } from './modules/institutions/institutions.repository';
import { merchantsPort, merchantsRepository } from './modules/merchants/merchants.repository';
import { productsPort, productsRepository } from './modules/products/products.repository';
import { productRulesPort, productRulesRepository } from './modules/product-rules/productRules.repository';
import { recurringsPort, recurringsRepository } from './modules/recurrings/recurrings.repository';
import { tagsPort, tagsRepository } from './modules/tags/tags.repository';
import { transactionsPort, transactionsRepository } from './modules/transactions/transactions.repository';
import { createAiAllowance } from './modules/users/aiAllowance';
import { usersRepository } from './modules/users/users.repository';
import { createGeminiExtractor } from './providers/ai/gemini';
import { createGoogleDrive } from './providers/drive/googleDrive';
import { createUnpdfReader } from './providers/pdf/unpdf';
import { createOpenExchangeRates } from './providers/rates/openExchangeRates';
import { wireServices } from './wiring';

/**
 * Every collection of user data, plus the list of applied migrations.
 * Registering a port here is what puts a collection into the backup, the
 * restore and the integrity check. `users` is left out on purpose: see its model.
 */
const collectionPorts: readonly CollectionPort[] = [
  institutionsPort,
  accountsPort,
  categoriesPort,
  tagsPort,
  merchantsPort,
  productsPort,
  documentsPort,
  installmentPlansPort,
  cardPeriodsPort,
  recurringsPort,
  categoryRulesPort,
  productRulesPort,
  exchangeRatesPort,
  transactionsPort,
  migrationsPort,
];

/**
 * The composition root for production: the real repositories, the real
 * database transactions and the configuration, handed to the wiring.
 */
export function createContainer(env: Env): Container {
  const today = () => todayIso(env.APP_TIMEZONE);
  // Built first: the documents service counts against it and the users service shows it.
  const aiAllowance = createAiAllowance(usersRepository, { today, dailyReadings: env.AI_DAILY_READINGS });

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
      exchangeRates: exchangeRatesRepository,
      installmentPlans: installmentPlansRepository,
      institutions: institutionsRepository,
      merchants: merchantsRepository,
      products: productsRepository,
      productRules: productRulesRepository,
      recurrings: recurringsRepository,
      tags: tagsRepository,
      transactions: transactionsRepository,
    },
    {
      runInTransaction: withTransaction,
      today,
      now: () => new Date(),
      extractor,
      pdfReader: createUnpdfReader(),
      rates: createOpenExchangeRates({
        onError: (error) => logger.warn({ err: error }, 'Reference rate unavailable'),
      }),
      schedule: (work) => {
        work().catch((error: unknown) => logger.error({ err: error }, 'Background work failed'));
      },
      owner: currentUserId,
      takeAiReading: () => aiAllowance.take(currentUserId()),
      onError: (error, context) => logger.warn({ err: error, ...context }, 'Document could not be read'),
    },
  );

  // The one place that decides where each user's automatic backup goes.
  const driveProvider =
    env.DRIVE_CLIENT_ID && env.DRIVE_CLIENT_SECRET && env.PUBLIC_API_URL
      ? createGoogleDrive({
          clientId: env.DRIVE_CLIENT_ID,
          clientSecret: env.DRIVE_CLIENT_SECRET,
          redirectUri: `${env.PUBLIC_API_URL}${API_PREFIX}${DRIVE_CALLBACK_ROUTE}`,
        })
      : null;

  return buildContainer({
    services,
    usersRepository,
    collectionPorts,
    runInTransaction: withTransaction,
    driveProvider,
    afterRestore: (applied) => runMissingMigrations(migrations, applied),
    now: () => new Date(),
    onError: (error, context) => logger.warn({ err: error, ...context }, 'Drive backup failed'),
    secret: env.JWT_SECRET,
    sessionDays: env.JWT_EXPIRES_DAYS,
    aiAllowance,
  });
}
