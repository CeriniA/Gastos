import {
  MAX_IMPORT_ROWS,
  categoryPathKey,
  mapHeaders,
  nameKey,
  parseImportRecord,
  pathOf,
  CATEGORY_PATH_SEPARATOR,
  type Account,
  type Category,
  type CategoryKind,
  type ExportQuery,
  type ImportCategoryRef,
  type ImportCommit,
  type ImportIssue,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportRecord,
  type ImportResult,
  type ImportReview,
  type ImportRow,
  type Installment,
  type IsoDate,
  type Tag,
  type Transaction,
  type TransactionCreate,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { ValidationError } from '../../core/errors/errors';
import { readTable, writeCsv, writeXlsx, type GeneratedFile } from './spreadsheet.files';

/** What the import and export need from the rest of the app. */
export interface SpreadsheetDependencies {
  listAccounts(): Promise<Account[]>;
  listCategories(options?: WriteOptions): Promise<Category[]>;
  listTags(options?: WriteOptions): Promise<Tag[]>;
  ensureCategoryPath(
    kind: CategoryKind,
    path: readonly string[],
    options: WriteOptions,
  ): Promise<{ category: Category; created: number }>;
  ensureTags(names: readonly string[], options: WriteOptions): Promise<{ tags: Tag[]; created: number }>;
  listTransactionsForExport(range: { from?: string; to?: string }): Promise<Transaction[]>;
  createTransactions(
    entries: readonly { input: TransactionCreate; installment: Installment | null }[],
    options: WriteOptions,
  ): Promise<number>;
  findDuplicates(
    candidates: readonly { date: string; amountCents: number; accountId: string }[],
  ): Promise<boolean[]>;
  today(): IsoDate;
  runInTransaction: TransactionRunner;
}

/** Index of every existing category by its kind and full path of names. */
function indexCategoryPaths(categories: readonly Category[]): Map<string, Category> {
  return new Map(
    categories.map((category) => [categoryPathKey(category.kind, pathOf(category.id, categories)), category]),
  );
}

export function createSpreadsheetService(deps: SpreadsheetDependencies) {
  async function loadLookups(options: WriteOptions = {}) {
    const [accounts, categories, tags] = await Promise.all([
      deps.listAccounts(),
      deps.listCategories(options),
      deps.listTags(options),
    ]);
    return {
      accountsByName: new Map(accounts.map((account) => [nameKey(account.name), account])),
      categoriesByPath: indexCategoryPaths(categories),
      tagsByName: new Map(tags.map((tag) => [nameKey(tag.name), tag])),
    };
  }

  /** Problems that only show up when a row is compared with the stored data. */
  function referenceIssues(
    row: ImportRow,
    accountsByName: Map<string, Account>,
    today: IsoDate,
  ): ImportIssue[] {
    const issues: ImportIssue[] = [];
    if (row.date > today) issues.push({ column: 'date', code: 'future_date' });

    const account = accountsByName.get(nameKey(row.account));
    if (!account) issues.push({ column: 'account', code: 'unknown_account' });
    else if (account.archived) issues.push({ column: 'account', code: 'archived_account' });
    else if (account.currency !== row.currency)
      issues.push({ column: 'currency', code: 'currency_mismatch' });

    if (row.type === 'transfer' && row.toAccount) {
      const destination = accountsByName.get(nameKey(row.toAccount));
      if (!destination) issues.push({ column: 'toAccount', code: 'unknown_account' });
      else if (account) {
        const crossCurrency = destination.currency !== account.currency;
        if (crossCurrency && row.toAmountCents === null) {
          issues.push({ column: 'toAmount', code: 'destination_amount_required' });
        }
        if (!crossCurrency && row.toAmountCents !== null) {
          issues.push({ column: 'toAmount', code: 'destination_amount_not_allowed' });
        }
      }
    } else if (row.toAmountCents !== null) {
      issues.push({ column: 'toAmount', code: 'destination_amount_not_allowed' });
    }
    return issues;
  }

  /**
   * Compares parsed rows with the stored data: references, duplicates, and
   * what the import would have to create. Rows that did not parse are kept
   * as they came.
   */
  async function checkRows(
    parsed: readonly ImportPreviewRow[],
  ): Promise<Omit<ImportPreview, 'fileName' | 'missingHeaders' | 'unknownHeaders'>> {
    const lookups = await loadLookups();
    const today = deps.today();
    const unknownAccounts = new Map<string, string>();
    const newCategories = new Map<string, ImportCategoryRef>();
    const newTags = new Map<string, string>();

    const rows: ImportPreviewRow[] = parsed.map((entry) => {
      const row = entry.row;
      if (!row) return entry;
      for (const name of [row.account, row.toAccount]) {
        if (name && !lookups.accountsByName.has(nameKey(name))) unknownAccounts.set(nameKey(name), name);
      }
      if (row.type !== 'transfer' && row.categoryPath.length > 0) {
        const key = categoryPathKey(row.type, row.categoryPath);
        if (!lookups.categoriesByPath.has(key)) {
          newCategories.set(key, { kind: row.type, path: row.categoryPath });
        }
      }
      for (const tag of row.tags) {
        if (!lookups.tagsByName.has(nameKey(tag))) newTags.set(nameKey(tag), tag);
      }
      return { ...entry, issues: referenceIssues(row, lookups.accountsByName, today), duplicate: false };
    });

    const candidates = rows.flatMap((entry, index) => {
      const account = entry.row ? lookups.accountsByName.get(nameKey(entry.row.account)) : undefined;
      return entry.row && account
        ? [{ index, date: entry.row.date, amountCents: entry.row.amountCents, accountId: account.id }]
        : [];
    });
    const duplicates = await deps.findDuplicates(candidates);
    candidates.forEach((candidate, position) => {
      rows[candidate.index]!.duplicate = duplicates[position] ?? false;
    });

    const byText = (a: string, b: string) => a.localeCompare(b, 'es');
    const label = (ref: ImportCategoryRef) => ref.path.join(CATEGORY_PATH_SEPARATOR);
    const validRows = rows.filter((entry) => entry.row && entry.issues.length === 0).length;
    return {
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      duplicateRows: rows.filter((entry) => entry.duplicate).length,
      unknownAccounts: [...unknownAccounts.values()].sort(byText),
      newCategories: [...newCategories.values()].sort((a, b) => byText(label(a), label(b))),
      newTags: [...newTags.values()].sort(byText),
      rows,
    };
  }

  return {
    /**
     * Reads the file and reports, row by row, what would be imported and what
     * is wrong. Writes nothing.
     */
    async preview(file: { content: Buffer; fileName: string }): Promise<ImportPreview> {
      const table = await readTable(file.content, file.fileName);
      const [header, ...dataRows] = table;
      if (!header) throw new ValidationError('The file is empty');
      if (dataRows.length > MAX_IMPORT_ROWS) {
        throw new ValidationError(`A file can have up to ${MAX_IMPORT_ROWS} rows`, { rows: dataRows.length });
      }

      const mapping = mapHeaders(header.cells);
      const preview: ImportPreview = {
        fileName: file.fileName,
        totalRows: dataRows.length,
        validRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        missingHeaders: mapping.missing,
        unknownHeaders: mapping.unknown,
        unknownAccounts: [],
        newCategories: [],
        newTags: [],
        rows: [],
      };
      if (mapping.missing.length > 0) return preview;

      const parsed: ImportPreviewRow[] = dataRows.map(({ line, cells }) => {
        const record: ImportRecord = {};
        mapping.columns.forEach((key, index) => {
          if (key) record[key] = cells[index];
        });
        const result = parseImportRecord(record);
        return { line, row: result.row, issues: result.issues, duplicate: false };
      });
      return { ...preview, ...(await checkRows(parsed)) };
    },

    /**
     * Checks again rows the user adjusted after the preview, exactly as the
     * preview would. Writes nothing.
     */
    async review(input: ImportReview): Promise<ImportPreview> {
      const checked = await checkRows(
        input.rows.map(({ line, row }) => ({ line, row, issues: [], duplicate: false })),
      );
      return { fileName: '', missingHeaders: [], unknownHeaders: [], ...checked };
    },

    /**
     * Imports the rows the user confirmed. Every row is checked again and the
     * whole import is one transaction: all rows are stored, or none.
     */
    async commit(input: ImportCommit): Promise<ImportResult> {
      const today = deps.today();
      return deps.runInTransaction(async (session) => {
        const options = { session };
        const lookups = await loadLookups(options);

        const issues = input.rows.flatMap((row, index) =>
          referenceIssues(row, lookups.accountsByName, today).map((issue) => ({
            path: `rows.${index}.${issue.column}`,
            message: issue.code,
          })),
        );
        if (issues.length > 0) throw new ValidationError('Some rows cannot be imported', { issues });

        const missingTags = [...new Set(input.rows.flatMap((row) => row.tags))].filter(
          (tag) => !lookups.tagsByName.has(nameKey(tag)),
        );
        const missingPaths = new Map<string, { kind: CategoryKind; path: string[] }>();
        for (const row of input.rows) {
          if (row.type === 'transfer' || row.categoryPath.length === 0) continue;
          const key = categoryPathKey(row.type, row.categoryPath);
          if (!lookups.categoriesByPath.has(key))
            missingPaths.set(key, { kind: row.type, path: row.categoryPath });
        }
        if (!input.createMissing && (missingTags.length > 0 || missingPaths.size > 0)) {
          throw new ValidationError('The file mentions categories or tags that do not exist', {
            categories: [...missingPaths.values()].map((entry) => entry.path.join(CATEGORY_PATH_SEPARATOR)),
            tags: missingTags,
          });
        }

        let createdCategories = 0;
        for (const [key, entry] of missingPaths) {
          const ensured = await deps.ensureCategoryPath(entry.kind, entry.path, options);
          lookups.categoriesByPath.set(key, ensured.category);
          createdCategories += ensured.created;
        }
        const ensuredTags = await deps.ensureTags(missingTags, options);
        for (const tag of ensuredTags.tags) lookups.tagsByName.set(nameKey(tag.name), tag);

        const entries = input.rows.map((row) => {
          const category =
            row.type !== 'transfer' && row.categoryPath.length > 0
              ? lookups.categoriesByPath.get(categoryPathKey(row.type, row.categoryPath))
              : undefined;
          const transaction: TransactionCreate = {
            type: row.type,
            date: row.date,
            amountCents: row.amountCents,
            currency: row.currency,
            accountId: lookups.accountsByName.get(nameKey(row.account))!.id,
            categoryId: category?.id ?? null,
            description: row.description,
            note: row.note,
            tagIds: row.tags.map((tag) => lookups.tagsByName.get(nameKey(tag))!.id),
            splits: [],
            toAccountId: row.toAccount ? lookups.accountsByName.get(nameKey(row.toAccount))!.id : null,
            toAmountCents: row.toAmountCents,
            paymentDate: row.paymentDate,
            original: null,
          };
          const installment: Installment | null = row.installment
            ? { planId: null, ...row.installment }
            : null;
          return { input: transaction, installment };
        });

        const imported = await deps.createTransactions(entries, options);
        return { imported, createdCategories, createdTags: ensuredTags.created };
      });
    },

    /**
     * Writes confirmed transactions in the import format. A transaction split
     * across categories becomes one row per part; the JSON backup is the copy
     * that keeps everything exactly.
     */
    async exportTransactions(query: ExportQuery): Promise<GeneratedFile> {
      const [transactions, accounts, categories, tags] = await Promise.all([
        deps.listTransactionsForExport({ from: query.from, to: query.to }),
        deps.listAccounts(),
        deps.listCategories(),
        deps.listTags(),
      ]);
      const accountName = new Map(accounts.map((account) => [account.id, account.name]));
      const tagName = new Map(tags.map((tag) => [tag.id, tag.name]));

      const rows: ImportRow[] = transactions
        .filter((transaction) => transaction.status === 'confirmed')
        .flatMap((transaction) => {
          const base = {
            date: transaction.date,
            type: transaction.type,
            currency: transaction.currency,
            account: accountName.get(transaction.accountId) ?? '',
            description: transaction.description,
            tags: transaction.tagIds.flatMap((id) => tagName.get(id) ?? []),
            note: transaction.note,
            installment: transaction.installment
              ? { number: transaction.installment.number, total: transaction.installment.total }
              : null,
            paymentDate: transaction.paymentDate === transaction.date ? null : transaction.paymentDate,
            toAccount: transaction.toAccountId ? (accountName.get(transaction.toAccountId) ?? null) : null,
            toAmountCents: transaction.toAmountCents,
          };
          if (transaction.splits.length === 0) {
            return [
              {
                ...base,
                amountCents: transaction.amountCents,
                categoryPath: transaction.categoryId ? pathOf(transaction.categoryId, categories) : [],
              },
            ];
          }
          return transaction.splits.map((split) => ({
            ...base,
            amountCents: split.amountCents,
            categoryPath: pathOf(split.categoryId, categories),
          }));
        });

      const stamp = deps.today();
      return query.format === 'csv'
        ? writeCsv(rows, `gastos-movimientos-${stamp}.csv`)
        : writeXlsx(rows, `gastos-movimientos-${stamp}.xlsx`);
    },

    /** An empty spreadsheet with the right headers, to fill in by hand. */
    template: (): Promise<GeneratedFile> => writeXlsx([], 'gastos-plantilla-importacion.xlsx'),
  };
}

export type SpreadsheetService = ReturnType<typeof createSpreadsheetService>;
