/**
 * Single source of truth for every enumerated value in the app.
 * Backend models, validation schemas and frontend forms all import from here.
 */

export const APP_ID = 'gastos';

/** Calendar days ("today", "this month") are worked out in this time zone. */
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Categories only exist for income and expense; transfers never carry one. */
export const CATEGORY_KINDS = ['income', 'expense'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const ACCOUNT_TYPES = ['cash', 'bank', 'wallet', 'credit_card'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * draft: extracted by the AI, waiting for the user's review.
 * confirmed: counted in reports.
 * projected: future installment or recurring item, not yet seen in a statement.
 */
export const TRANSACTION_STATUSES = ['draft', 'confirmed', 'projected'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_SOURCES = ['manual', 'document', 'import', 'installment'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const DOCUMENT_KINDS = ['receipt', 'screenshot', 'card_statement'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ['processing', 'ready', 'confirmed', 'discarded', 'error'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const MAX_CATEGORY_DEPTH = 3;
export const TRASH_RETENTION_DAYS = 30;
export const MAX_IMPORT_ROWS = 2000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Bump when the backup file layout changes; restore refuses newer versions. */
export const BACKUP_FORMAT_VERSION = 1;

export const API_PREFIX = '/api/v1';

/** Machine-readable error codes. The frontend maps each one to a Spanish message. */
export const ERROR_CODES = [
  'VALIDATION',
  'NOT_FOUND',
  'CONFLICT',
  'DUPLICATE',
  'IN_USE',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INVALID_BACKUP',
  'INTEGRITY',
  'AI_PROVIDER',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown; requestId?: string };
}
export interface ApiSuccessBody<T> {
  data: T;
}
