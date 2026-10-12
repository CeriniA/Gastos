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

/** What can be uploaded today. Card statements arrive with stage 3. */
export const UPLOADABLE_DOCUMENT_KINDS = ['receipt', 'screenshot'] as const;
export type UploadableDocumentKind = (typeof UPLOADABLE_DOCUMENT_KINDS)[number];

export const DOCUMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type DocumentImageType = (typeof DOCUMENT_IMAGE_TYPES)[number];

/** Why a document could not be read. The frontend maps each one to a Spanish message. */
export const DOCUMENT_ERROR_CODES = [
  'rate_limited',
  'unavailable',
  'not_configured',
  'blocked',
  'unreadable',
] as const;
export type DocumentErrorCode = (typeof DOCUMENT_ERROR_CODES)[number];

/** A long receipt can be photographed in several parts. */
export const MAX_DOCUMENT_FILES = 10;
/** All the parts of one document together; MongoDB stores at most 16 MB per document. */
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

/**
 * What kind of thing a purchased product is. A short, fixed list so that
 * consumption can be compared month to month. Separate from categories: a
 * category files a whole transaction, a group files one line of a receipt.
 */
export const PRODUCT_GROUPS = [
  'pantry',
  'meat',
  'dairy',
  'produce',
  'bakery',
  'beverages',
  'alcohol',
  'frozen',
  'prepared_food',
  'cleaning',
  'personal_care',
  'pharmacy',
  'baby',
  'pets',
  'household',
  'other',
] as const;
export type ProductGroup = (typeof PRODUCT_GROUPS)[number];

export const MAX_CATEGORY_DEPTH = 3;
export const TRASH_RETENTION_DAYS = 30;
/** An upload nobody reviewed is dropped after this long, images included. */
export const PENDING_DOCUMENT_RETENTION_DAYS = 30;
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
