import type { IsoDate } from '@gastos/shared';
import type { TransactionRunner } from './core/db/transaction';
import type { AccountsRepository } from './modules/accounts/accounts.repository';
import { createAccountsService, type AccountsService } from './modules/accounts/accounts.service';
import type { CategoriesRepository } from './modules/categories/categories.repository';
import { createCategoriesService, type CategoriesService } from './modules/categories/categories.service';
import { createSpreadsheetService, type SpreadsheetService } from './modules/spreadsheet/spreadsheet.service';
import type { TagsRepository } from './modules/tags/tags.repository';
import { createTagsService, type TagsService } from './modules/tags/tags.service';
import type { TransactionsRepository } from './modules/transactions/transactions.repository';
import {
  createTransactionsService,
  type TransactionsService,
} from './modules/transactions/transactions.service';

export interface Repositories {
  accounts: AccountsRepository;
  categories: CategoriesRepository;
  tags: TagsRepository;
  transactions: TransactionsRepository;
}

export interface Services {
  accounts: AccountsService;
  categories: CategoriesService;
  tags: TagsService;
  transactions: TransactionsService;
  spreadsheet: SpreadsheetService;
}

/**
 * Connects the services to each other. A module never imports another
 * module's internals: whatever it needs from the rest of the app is handed to
 * it here as a small set of functions.
 *
 * This file knows nothing about the database, so the same wiring runs in
 * production (composition.ts) and in tests (testing/memory.ts).
 */
export function wireServices(
  repositories: Repositories,
  runInTransaction: TransactionRunner,
  today: () => IsoDate,
): Services {
  // Declared first because accounts, categories and tags ask it about usage.
  // It reaches them through functions, so the order of creation does not matter.
  const transactions: TransactionsService = createTransactionsService(repositories.transactions, {
    listAccounts: () => accounts.list(),
    listCategories: (options) => categories.list(options),
    listTags: (options) => tags.list(options),
    today,
  });

  const accounts: AccountsService = createAccountsService(repositories.accounts, {
    countTransactions: transactions.countByAccount,
  });

  const categories: CategoriesService = createCategoriesService(
    repositories.categories,
    { countTransactions: transactions.countByCategory, moveTransactions: transactions.moveCategory },
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

  return { accounts, categories, tags, transactions, spreadsheet };
}
