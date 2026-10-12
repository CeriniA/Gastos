import { z } from 'zod';
import {
  CURRENCIES,
  MAX_CATEGORY_DEPTH,
  MAX_IMPORT_ROWS,
  TRANSACTION_TYPES,
  type CategoryKind,
  type Currency,
  type TransactionType,
} from './constants';
import { parseFlexibleDate } from './dates';
import { centsToDecimalString, parseAmountToCents } from './money';
import { isoDateSchema } from './schemas/common';
import { nameKey } from './text';

/**
 * The spreadsheet format for moving transactions in and out of the app.
 * Export writes exactly these columns; import reads them back. One definition,
 * so a file the app exported can always be imported again.
 *
 * Headers are in Spanish because the file is handled by the user.
 */
export const IMPORT_COLUMNS = [
  { key: 'date', header: 'Fecha', required: true },
  { key: 'type', header: 'Tipo', required: true },
  { key: 'amount', header: 'Monto', required: true },
  { key: 'currency', header: 'Moneda', required: true },
  { key: 'account', header: 'Cuenta', required: true },
  { key: 'category', header: 'Categoría', required: false },
  { key: 'description', header: 'Descripción', required: false },
  { key: 'tags', header: 'Etiquetas', required: false },
  { key: 'note', header: 'Nota', required: false },
  { key: 'installment', header: 'Cuota', required: false },
  { key: 'paymentDate', header: 'Fecha de pago', required: false },
  { key: 'toAccount', header: 'Cuenta destino', required: false },
  { key: 'toAmount', header: 'Monto destino', required: false },
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]['key'];
export type ImportRecord = Partial<Record<ImportColumnKey, unknown>>;

export const CATEGORY_PATH_SEPARATOR = ' > ';
export const TAG_SEPARATOR = ', ';

export const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'egreso',
  income: 'ingreso',
  transfer: 'transferencia',
};

const TYPE_SYNONYMS: Record<string, TransactionType> = {
  egreso: 'expense',
  gasto: 'expense',
  expense: 'expense',
  ingreso: 'income',
  income: 'income',
  transferencia: 'transfer',
  transfer: 'transfer',
};

const CURRENCY_SYNONYMS: Record<string, Currency> = {
  ars: 'ARS',
  peso: 'ARS',
  pesos: 'ARS',
  $: 'ARS',
  usd: 'USD',
  dolar: 'USD',
  dolares: 'USD',
  u$s: 'USD',
  us$: 'USD',
};

const HEADER_ALIASES: Record<string, ImportColumnKey> = {
  importe: 'amount',
  detalle: 'description',
  concepto: 'description',
  etiqueta: 'tags',
  notas: 'note',
  cuotas: 'installment',
};

const HEADER_LOOKUP = new Map<string, ImportColumnKey>([
  ...IMPORT_COLUMNS.map((column) => [nameKey(column.header), column.key] as const),
  ...Object.entries(HEADER_ALIASES),
]);

export interface HeaderMapping {
  /** For each column of the file, the field it feeds, or null when unrecognised. */
  columns: (ImportColumnKey | null)[];
  /** Required headers the file does not have. */
  missing: string[];
  /** Headers of the file that the app ignores. */
  unknown: string[];
}

export function mapHeaders(headers: readonly unknown[]): HeaderMapping {
  const columns = headers.map((header) => HEADER_LOOKUP.get(nameKey(cellText(header))) ?? null);
  const present = new Set(columns);
  return {
    columns,
    missing: IMPORT_COLUMNS.filter((column) => column.required && !present.has(column.key)).map(
      (column) => column.header,
    ),
    unknown: headers.map(cellText).filter((header, index) => header !== '' && columns[index] === null),
  };
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return parseFlexibleDate(value) ?? '';
  return String(value).trim();
}

export const IMPORT_ISSUE_CODES = [
  'required',
  'invalid_date',
  'future_date',
  'invalid_type',
  'invalid_amount',
  'invalid_currency',
  'invalid_installment',
  'category_too_deep',
  'transfer_needs_destination',
  'transfer_has_category',
  'destination_without_transfer',
  'same_account',
  'unknown_account',
  'archived_account',
  'currency_mismatch',
  'unknown_category',
  'unknown_tag',
  'destination_amount_required',
  'destination_amount_not_allowed',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export interface ImportIssue {
  column: ImportColumnKey;
  code: ImportIssueCode;
}

const installmentSchema = z
  .object({ number: z.number().int().min(1), total: z.number().int().min(1).max(120) })
  .refine((value) => value.number <= value.total, 'Installment number exceeds the total');

/** A spreadsheet row after parsing: names instead of ids, amounts in cents. */
export const importRowSchema = z
  .object({
    date: isoDateSchema,
    type: z.enum(TRANSACTION_TYPES),
    amountCents: z.number().int().positive(),
    currency: z.enum(CURRENCIES),
    account: z.string().trim().min(1).max(60),
    categoryPath: z.array(z.string().trim().min(1).max(60)).max(MAX_CATEGORY_DEPTH),
    description: z.string().trim().max(200),
    tags: z.array(z.string().trim().min(1).max(60)).max(20),
    note: z.string().trim().max(1000),
    installment: installmentSchema.nullable(),
    paymentDate: isoDateSchema.nullable(),
    toAccount: z.string().trim().min(1).max(60).nullable(),
    toAmountCents: z.number().int().positive().nullable(),
  })
  .superRefine((row, context) => {
    for (const issue of crossFieldIssues(row)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.column], message: issue.code });
    }
  });
export type ImportRow = z.infer<typeof importRowSchema>;

function crossFieldIssues(row: {
  type: TransactionType;
  account: string;
  categoryPath: readonly string[];
  toAccount: string | null;
}): ImportIssue[] {
  const issues: ImportIssue[] = [];
  if (row.type === 'transfer') {
    if (!row.toAccount) issues.push({ column: 'toAccount', code: 'transfer_needs_destination' });
    else if (nameKey(row.toAccount) === nameKey(row.account)) {
      issues.push({ column: 'toAccount', code: 'same_account' });
    }
    if (row.categoryPath.length > 0) issues.push({ column: 'category', code: 'transfer_has_category' });
  } else if (row.toAccount) {
    issues.push({ column: 'toAccount', code: 'destination_without_transfer' });
  }
  return issues;
}

function parseOptionalAmount(value: unknown): number | null | 'invalid' {
  if (cellText(value) === '') return null;
  const cents = parseAmountToCents(typeof value === 'number' ? value : cellText(value));
  return cents !== null && cents > 0 ? cents : 'invalid';
}

function uniqueByKey(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = nameKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Turns one spreadsheet row into an ImportRow. Never throws: every problem is
 * reported as an issue tied to its column, so the preview can show all of them.
 */
export function parseImportRecord(record: ImportRecord): { row: ImportRow | null; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const text = (key: ImportColumnKey) => cellText(record[key]);

  for (const column of IMPORT_COLUMNS) {
    if (column.required && text(column.key) === '') issues.push({ column: column.key, code: 'required' });
  }

  const date = parseFlexibleDate(record.date instanceof Date ? record.date : text('date'));
  if (!date && text('date') !== '') issues.push({ column: 'date', code: 'invalid_date' });

  const type = TYPE_SYNONYMS[nameKey(text('type'))];
  if (!type && text('type') !== '') issues.push({ column: 'type', code: 'invalid_type' });

  const amount = parseOptionalAmount(record.amount);
  if (amount === 'invalid') issues.push({ column: 'amount', code: 'invalid_amount' });

  const currency = CURRENCY_SYNONYMS[nameKey(text('currency'))];
  if (!currency && text('currency') !== '') issues.push({ column: 'currency', code: 'invalid_currency' });

  const categoryPath = text('category')
    .split('>')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (categoryPath.length > MAX_CATEGORY_DEPTH)
    issues.push({ column: 'category', code: 'category_too_deep' });

  let installment: ImportRow['installment'] = null;
  if (text('installment') !== '') {
    const match = /^(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})$/i.exec(text('installment'));
    const parsed = match ? { number: Number(match[1]), total: Number(match[2]) } : null;
    if (parsed && installmentSchema.safeParse(parsed).success) installment = parsed;
    else issues.push({ column: 'installment', code: 'invalid_installment' });
  }

  let paymentDate: string | null = null;
  if (text('paymentDate') !== '') {
    paymentDate = parseFlexibleDate(
      record.paymentDate instanceof Date ? record.paymentDate : text('paymentDate'),
    );
    if (!paymentDate) issues.push({ column: 'paymentDate', code: 'invalid_date' });
  }

  const toAmount = parseOptionalAmount(record.toAmount);
  if (toAmount === 'invalid') issues.push({ column: 'toAmount', code: 'invalid_amount' });

  const toAccount = text('toAccount') || null;
  if (type) {
    issues.push(...crossFieldIssues({ type, account: text('account'), categoryPath, toAccount }));
  }

  if (issues.length > 0 || !date || !type || !currency || typeof amount !== 'number') {
    return { row: null, issues };
  }
  return {
    row: {
      date,
      type,
      amountCents: amount,
      currency,
      account: text('account'),
      categoryPath,
      description: text('description').slice(0, 200),
      tags: uniqueByKey(
        text('tags')
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ''),
      ),
      note: text('note').slice(0, 1000),
      installment,
      paymentDate,
      toAccount,
      toAmountCents: typeof toAmount === 'number' ? toAmount : null,
    },
    issues,
  };
}

/** The text of every column for one row, in IMPORT_COLUMNS order. */
export function toExportRecord(row: ImportRow): Record<ImportColumnKey, string> {
  return {
    date: row.date,
    type: TYPE_LABELS[row.type],
    amount: centsToDecimalString(row.amountCents),
    currency: row.currency,
    account: row.account,
    category: row.categoryPath.join(CATEGORY_PATH_SEPARATOR),
    description: row.description,
    tags: row.tags.join(TAG_SEPARATOR),
    note: row.note,
    installment: row.installment ? `${row.installment.number}/${row.installment.total}` : '',
    paymentDate: row.paymentDate ?? '',
    toAccount: row.toAccount ?? '',
    toAmount: row.toAmountCents === null ? '' : centsToDecimalString(row.toAmountCents),
  };
}

/**
 * Identifies a category by its kind and path whatever the spelling, so
 * "Súper > Verdulería" in a file matches "super > verduleria" in the app.
 */
export function categoryPathKey(kind: CategoryKind, path: readonly string[]): string {
  return `${kind}|${path.map(nameKey).join('>')}`;
}

/** A category as a file names it: its kind and the names from the root down. */
export interface ImportCategoryRef {
  kind: CategoryKind;
  path: string[];
}

export interface ImportPreviewRow {
  /** Row number as the user sees it in the spreadsheet (the header is row 1). */
  line: number;
  row: ImportRow | null;
  issues: ImportIssue[];
  /** A transaction with the same date, amount and account already exists. */
  duplicate: boolean;
}

export interface ImportPreview {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  missingHeaders: string[];
  unknownHeaders: string[];
  /** Account names the file mentions and the app does not have. Accounts are never created by an import. */
  unknownAccounts: string[];
  /** Categories and tags that do not exist yet and would be created. */
  newCategories: ImportCategoryRef[];
  newTags: string[];
  rows: ImportPreviewRow[];
}

/**
 * Rows the user adjusted after the preview (an unknown account or category
 * pointed at an existing one), sent back to be checked again.
 */
export const importReviewSchema = z.object({
  rows: z
    .array(z.object({ line: z.number().int().positive(), row: importRowSchema }))
    .min(1)
    .max(MAX_IMPORT_ROWS),
});
export type ImportReview = z.infer<typeof importReviewSchema>;

export const importCommitSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(MAX_IMPORT_ROWS),
  /** Create the categories and tags the file mentions and the app lacks. */
  createMissing: z.boolean().default(false),
});
export type ImportCommit = z.infer<typeof importCommitSchema>;

export interface ImportResult {
  imported: number;
  createdCategories: number;
  createdTags: number;
}

export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).default('xlsx'),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
