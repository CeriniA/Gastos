import type { IsoDate } from '@gastos/shared';
import type { TransactionRunner } from './core/db/transaction';
import type { AccountsRepository } from './modules/accounts/accounts.repository';
import { createAccountsService, type AccountsService } from './modules/accounts/accounts.service';
import type { CategoriesRepository } from './modules/categories/categories.repository';
import { createCategoriesService, type CategoriesService } from './modules/categories/categories.service';
import type { CategoryRulesRepository } from './modules/category-rules/categoryRules.repository';
import {
  createCategoryRulesService,
  type CategoryRulesService,
} from './modules/category-rules/categoryRules.service';
import { createConsumptionService, type ConsumptionService } from './modules/consumption/consumption.service';
import type { DocumentsRepository } from './modules/documents/documents.repository';
import { createDocumentsService, type DocumentsService } from './modules/documents/documents.service';
import {
  createExchangeRatesService,
  type ExchangeRatesService,
} from './modules/exchange-rates/exchangeRates.service';
import { createSpreadsheetService, type SpreadsheetService } from './modules/spreadsheet/spreadsheet.service';
import type { TagsRepository } from './modules/tags/tags.repository';
import { createTagsService, type TagsService } from './modules/tags/tags.service';
import type { TransactionsRepository } from './modules/transactions/transactions.repository';
import {
  createTransactionsService,
  type TransactionsService,
} from './modules/transactions/transactions.service';
import type { AiExtractor } from './providers/ai/aiExtractor';
import type { RateProvider } from './providers/rates/rateProvider';

export interface Repositories {
  accounts: AccountsRepository;
  categories: CategoriesRepository;
  categoryRules: CategoryRulesRepository;
  documents: DocumentsRepository;
  tags: TagsRepository;
  transactions: TransactionsRepository;
}

/** Everything the services need that is not another service. */
export interface Runtime {
  runInTransaction: TransactionRunner;
  /** Today's calendar day in the app's time zone. */
  today: () => IsoDate;
  /** The current moment. A function so tests can move the clock. */
  now: () => Date;
  /** Null when no AI key is configured. */
  extractor: AiExtractor | null;
  /** Public exchange rates, offered as a starting point. Null to do without. */
  rates: RateProvider | null;
  /** Starts background work without waiting for it. */
  schedule: (work: () => Promise<void>) => void;
  onError: (error: unknown, context: object) => void;
}

export interface Services {
  accounts: AccountsService;
  categories: CategoriesService;
  categoryRules: CategoryRulesService;
  consumption: ConsumptionService;
  documents: DocumentsService;
  exchangeRates: ExchangeRatesService;
  tags: TagsService;
  transactions: TransactionsService;
  spreadsheet: SpreadsheetService;
}

/**
 * Connects the services to each other. A module never imports another
 * module's internals: whatever it needs from the rest of the app is handed to
 * it here as a small set of functions.
 *
 * This file knows nothing about the database or about which AI is used, so
 * the same wiring runs in production (composition.ts) and in tests
 * (testing/memory.ts).
 */
export function wireServices(repositories: Repositories, runtime: Runtime): Services {
  const { runInTransaction, today } = runtime;

  // Declared first because the others ask it about usage. It reaches them
  // through functions, so the order of creation does not matter.
  const transactions: TransactionsService = createTransactionsService(repositories.transactions, {
    listAccounts: () => accounts.list(),
    listCategories: (options) => categories.list(options),
    listTags: (options) => tags.list(options),
    today,
  });

  const accounts: AccountsService = createAccountsService(repositories.accounts, {
    countTransactions: transactions.countByAccount,
  });

  const categoryRules: CategoryRulesService = createCategoryRulesService(repositories.categoryRules, {
    listCategories: (options) => categories.list(options),
  });

  const categories: CategoriesService = createCategoriesService(
    repositories.categories,
    {
      countTransactions: transactions.countByCategory,
      moveTransactions: transactions.moveCategory,
      moveRules: categoryRules.moveCategory,
      removeRules: categoryRules.removeByCategory,
    },
    runInTransaction,
  );

  const tags: TagsService = createTagsService(
    repositories.tags,
    { removeTagEverywhere: transactions.removeTag },
    runInTransaction,
  );

  const spreadsheet: SpreadsheetService = createSpreadsheetService({
    listAccounts: accounts.list,
    listCategories: categories.list,
    listTags: tags.list,
    ensureCategoryPath: categories.ensurePath,
    ensureTags: tags.ensureByNames,
    listTransactionsForExport: transactions.listForExport,
    createTransactions: (entries, options) => transactions.createMany(entries, 'import', options),
    findDuplicates: transactions.findDuplicates,
    today,
    runInTransaction,
  });

  const documents: DocumentsService = createDocumentsService(repositories.documents, {
    extractor: runtime.extractor,
    listAccounts: accounts.list,
    listCategories: categories.list,
    ruleLookup: () => categoryRules.lookup(),
    saveRule: categoryRules.save,
    createTransactions: (entries, options) => transactions.createMany(entries, 'document', options),
    countLiveTransactions: transactions.countLiveByDocument,
    findSameDayAmounts: transactions.findSameDayAmounts,
    releaseTransactions: transactions.releaseDocument,
    trashTransactions: transactions.trashByDocument,
    runInTransaction,
    today,
    now: runtime.now,
    schedule: runtime.schedule,
    onError: runtime.onError,
  });

  const exchangeRates: ExchangeRatesService = createExchangeRatesService(runtime.rates);

  const consumption: ConsumptionService = createConsumptionService({ listItems: transactions.listItems });

  return {
    accounts,
    categories,
    categoryRules,
    consumption,
    documents,
    exchangeRates,
    tags,
    transactions,
    spreadsheet,
  };
}
