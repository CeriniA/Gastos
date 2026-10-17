import type { IsoDate } from '@gastos/shared';
import type { TransactionRunner } from './core/db/transaction';
import type { AccountsRepository } from './modules/accounts/accounts.repository';
import { createAccountsService, type AccountsService } from './modules/accounts/accounts.service';
import type { CardPeriodsRepository } from './modules/card-periods/cardPeriods.repository';
import {
  createCardPeriodsService,
  type CardPeriodsService,
} from './modules/card-periods/cardPeriods.service';
import type { CategoriesRepository } from './modules/categories/categories.repository';
import { createCategoriesService, type CategoriesService } from './modules/categories/categories.service';
import type { CategoryRulesRepository } from './modules/category-rules/categoryRules.repository';
import {
  createCategoryRulesService,
  type CategoryRulesService,
} from './modules/category-rules/categoryRules.service';
import { createConsumptionService, type ConsumptionService } from './modules/consumption/consumption.service';
import type { DocumentsRepository } from './modules/documents/documents.repository';
import type { InstallmentPlansRepository } from './modules/installment-plans/installmentPlans.repository';
import {
  createInstallmentPlansService,
  type InstallmentPlansService,
} from './modules/installment-plans/installmentPlans.service';
import type { InstitutionsRepository } from './modules/institutions/institutions.repository';
import {
  createInstitutionsService,
  type InstitutionsService,
} from './modules/institutions/institutions.service';
import { createDocumentsService, type DocumentsService } from './modules/documents/documents.service';
import type { ExchangeRatesRepository } from './modules/exchange-rates/exchangeRates.repository';
import {
  createExchangeRatesService,
  type ExchangeRatesService,
} from './modules/exchange-rates/exchangeRates.service';
import type { RecurringsRepository } from './modules/recurrings/recurrings.repository';
import { createRecurringsService, type RecurringsService } from './modules/recurrings/recurrings.service';
import { createReportsService, type ReportsService } from './modules/reports/reports.service';
import { createSpreadsheetService, type SpreadsheetService } from './modules/spreadsheet/spreadsheet.service';
import type { TagsRepository } from './modules/tags/tags.repository';
import { createTagsService, type TagsService } from './modules/tags/tags.service';
import type { TransactionsRepository } from './modules/transactions/transactions.repository';
import {
  createTransactionsService,
  type TransactionsService,
} from './modules/transactions/transactions.service';
import type { AiExtractor } from './providers/ai/aiExtractor';
import type { PdfTextReader } from './providers/pdf/pdfReader';
import type { RateProvider } from './providers/rates/rateProvider';

export interface Repositories {
  accounts: AccountsRepository;
  cardPeriods: CardPeriodsRepository;
  categories: CategoriesRepository;
  categoryRules: CategoryRulesRepository;
  documents: DocumentsRepository;
  exchangeRates: ExchangeRatesRepository;
  installmentPlans: InstallmentPlansRepository;
  institutions: InstitutionsRepository;
  recurrings: RecurringsRepository;
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
  /** Reads the text of card statements' PDFs. */
  pdfReader: PdfTextReader;
  /** Public exchange rates, offered as a starting point. Null to do without. */
  rates: RateProvider | null;
  /** Starts background work without waiting for it. */
  schedule: (work: () => Promise<void>) => void;
  /** The user the running code works for. */
  owner: () => string;
  /** Counts a document the running user sends to the AI; throws past their daily limit. */
  takeAiReading: () => Promise<void>;
  onError: (error: unknown, context: object) => void;
}

export interface Services {
  accounts: AccountsService;
  cardPeriods: CardPeriodsService;
  categories: CategoriesService;
  categoryRules: CategoryRulesService;
  consumption: ConsumptionService;
  documents: DocumentsService;
  exchangeRates: ExchangeRatesService;
  installmentPlans: InstallmentPlansService;
  institutions: InstitutionsService;
  recurrings: RecurringsService;
  reports: ReportsService;
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
    listCardPeriods: (options) => cardPeriods.listDates(options),
    today,
  });

  const accounts: AccountsService = createAccountsService(repositories.accounts, {
    countTransactions: transactions.countByAccount,
    countCardPeriods: async (id) =>
      (await cardPeriods.countByAccount(id)) +
      (await installmentPlans.countByAccount(id)) +
      (await recurrings.countByAccount(id)),
    findInstitution: (id) => institutions.find(id),
  });

  const cardPeriods: CardPeriodsService = createCardPeriodsService(repositories.cardPeriods, {
    listAccounts: () => accounts.list(),
    refreshPaymentDates: transactions.refreshPaymentDates,
    listCharges: transactions.listCharges,
    createPayment: transactions.createCardPayment,
    paidByPeriod: transactions.paidByCardPeriod,
    releasePayments: transactions.releaseCardPeriod,
    runInTransaction,
  });

  const installmentPlans: InstallmentPlansService = createInstallmentPlansService(
    repositories.installmentPlans,
    {
      listAccounts: () => accounts.list(),
      createTransactions: (entries, options) => transactions.createMany(entries, 'installment', options),
      trashTransactions: transactions.trashByPlan,
      listClosingDates: async (accountId) =>
        (await cardPeriods.listDates())
          .filter((period) => period.accountId === accountId)
          .map((period) => period.closingDate),
      today,
      runInTransaction,
    },
  );

  const institutions: InstitutionsService = createInstitutionsService(repositories.institutions, {
    countAccounts: accounts.countByInstitution,
  });

  const categoryRules: CategoryRulesService = createCategoryRulesService(repositories.categoryRules, {
    listCategories: (options) => categories.list(options),
  });

  const categories: CategoriesService = createCategoriesService(
    repositories.categories,
    {
      countTransactions: transactions.countByCategory,
      moveTransactions: transactions.moveCategory,
      moveRules: async (fromId, toId, options) => {
        await categoryRules.moveCategory(fromId, toId, options);
        await recurrings.moveCategory(fromId, toId, options);
      },
      removeRules: async (categoryId, options) => {
        await categoryRules.removeByCategory(categoryId, options);
        await recurrings.clearCategory(categoryId, options);
      },
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
    pdfReader: runtime.pdfReader,
    listAccounts: accounts.list,
    listCategories: categories.list,
    ruleLookup: () => categoryRules.lookup(),
    saveRule: categoryRules.save,
    createTransactions: (entries, options) => transactions.createMany(entries, 'document', options),
    countLiveTransactions: transactions.countLiveByDocument,
    findSameDayAmounts: transactions.findSameDayAmounts,
    findInstallments: transactions.findInstallments,
    releaseTransactions: transactions.releaseDocument,
    trashTransactions: transactions.trashByDocument,
    createCardPeriods: cardPeriods.createFromDocument,
    releaseCardPeriods: cardPeriods.releaseDocument,
    continueInstallments: (input, options) => installmentPlans.continueFromStatement(input, options),
    takeAiReading: runtime.takeAiReading,
    runInTransaction,
    today,
    now: runtime.now,
    schedule: runtime.schedule,
    owner: runtime.owner,
    onError: runtime.onError,
  });

  const exchangeRates: ExchangeRatesService = createExchangeRatesService(
    repositories.exchangeRates,
    runtime.rates,
  );

  const recurrings: RecurringsService = createRecurringsService(repositories.recurrings, {
    listRows: transactions.listReportRows,
    findTransaction: transactions.get,
    listAccounts: () => accounts.list(),
    listCategories: () => categories.list(),
    markTransaction: transactions.markRecurring,
    releaseTransactions: transactions.releaseRecurring,
    today,
    runInTransaction,
  });

  const consumption: ConsumptionService = createConsumptionService({ listItems: transactions.listItems });

  const reports: ReportsService = createReportsService({
    listFiled: transactions.listFiled,
    listRows: transactions.listReportRows,
    listCategories: () => categories.list(),
    listAccounts: () => accounts.list(),
    listRates: () => exchangeRates.list(),
    expectedRecurrings: (month) => recurrings.expected(month),
    today,
  });

  return {
    reports,
    accounts,
    cardPeriods,
    categories,
    categoryRules,
    consumption,
    documents,
    exchangeRates,
    installmentPlans,
    institutions,
    recurrings,
    tags,
    transactions,
    spreadsheet,
  };
}
