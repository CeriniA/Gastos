/**
 * Single source of truth for every enumerated value in the app.
 * Backend models, validation schemas and frontend forms all import from here.
 */

export const APP_ID = 'gastos';

/** Calendar days ("today", "this month") are worked out in this time zone. */
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** The currency to assume when nothing says otherwise (a new account, a screen without one). */
export const DEFAULT_CURRENCY: Currency = 'ARS';

/** How long each kind of text the user types can be. Schemas, screens and the AI cleanup share them. */
export const TEXT_LIMITS = {
  /** Accounts, categories, tags, banks; also a search. */
  name: 60,
  /** Description, merchant, a receipt line. */
  description: 200,
  note: 1000,
  /** Generic product name ("Yerba"). */
  product: 80,
} as const;

/** Largest quantity a receipt line can carry (units, kilos or litres). */
export const MAX_ITEM_QUANTITY = 100_000;

/** Most installments a purchase can be split in. */
export const MAX_INSTALLMENTS = 60;

/** Most tags on one transaction, and most parts a transaction can be split in. */
export const MAX_TAGS = 20;
export const MAX_SPLITS = 20;

/** Most transactions one document can bring. */
export const MAX_DOCUMENT_TRANSACTIONS = 500;

/** Transactions a list page returns at once: by default, and at most. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** Largest amount accepted, in cents: far above any real purchase, so a typo with extra zeros is caught. */
export const MAX_AMOUNT_CENTS = 1_000_000_000_000;

/** Largest exchange rate accepted (units of the account currency per unit of the other). */
export const MAX_RATE = 1_000_000_000;

/** Longest username and password the login accepts. */
export const MAX_USERNAME_LENGTH = 100;
export const MAX_PASSWORD_LENGTH = 200;

/** Decimals kept in an exchange rate. */
export const RATE_DECIMALS = 6;

/** How much of a technical error is kept for the logs. */
export const MAX_ERROR_DETAIL = 500;

/** How numbers, money and dates are written for the user. */
export const APP_LOCALE = 'es-AR';

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Categories only exist for income and expense; transfers never carry one. */
export const CATEGORY_KINDS = ['income', 'expense'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const ACCOUNT_TYPES = ['cash', 'bank', 'wallet', 'credit_card'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Who issues an account (a bank) and, for a card, its brand (a network). */
export const INSTITUTION_KINDS = ['bank', 'network'] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];

/**
 * The expense category offered for interest, taxes and fees read from a
 * document. It is found by this name (the user's data, hence Spanish): if the
 * user renamed or archived it, nothing is forced and the AI's suggestion stands.
 */
export const FINANCIAL_CHARGES_CATEGORY = 'Cargos financieros';

/** Loaded once so the lists start useful; the user adds, renames or archives from there. */
export const DEFAULT_INSTITUTIONS: Record<InstitutionKind, readonly string[]> = {
  bank: [
    'Banco Nación',
    'Banco Provincia',
    'Banco Ciudad',
    'Galicia',
    'Santander',
    'BBVA',
    'Macro',
    'ICBC',
    'Credicoop',
    'Patagonia',
    'Supervielle',
    'Comafi',
    'Hipotecario',
    'Brubank',
    'Naranja X',
    'Mercado Pago',
    'Ualá',
  ],
  network: ['Visa', 'Mastercard', 'American Express', 'Cabal', 'Naranja'],
};

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

/** What can be uploaded as images. Card statements arrive as the text of their PDF instead. */
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

/**
 * When the AI is out of quota or down, a document waits and is tried again
 * on its own after these many minutes, one after the other (about 16 hours
 * in all). Only after the last one does it show as failed.
 */
export const DOCUMENT_RETRY_DELAYS_MINUTES = [1, 5, 15, 30, 60, 120, 240, 480] as const;

/** Failures that go away by themselves, so they are retried automatically. */
export const TRANSIENT_DOCUMENT_ERRORS = ['rate_limited', 'unavailable'] as const;

/** A long receipt can be photographed in several parts. */
export const MAX_DOCUMENT_FILES = 10;
/** All the parts of one document together; MongoDB stores at most 16 MB per document. */
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

/**
 * A card statement runs to a handful of pages. A longer PDF is not a
 * statement, and reading it would strain a server with 512 MB of memory.
 */
export const MAX_STATEMENT_PAGES = 20;
/** About twenty dense pages of text: the most one statement sends to the AI. */
export const MAX_STATEMENT_TEXT_LENGTH = 100_000;
/** Bank PDF passwords are short (often the holder's DNI); the limit only stops abuse. */
export const MAX_PDF_PASSWORD_LENGTH = 64;
/** A statement brings its own closing and due dates and, when printed, the next ones. */
export const MAX_STATEMENT_PERIODS = 2;
/** What a hidden piece of personal data becomes in the text the AI receives. */
export const REDACTION_MARK = '***';
/** Words the user hides in every statement (their name, their street). */
export const MAX_HIDDEN_WORDS = 20;
/** Shorter words ("de", "y") would blank out half the statement. */
export const MIN_HIDDEN_WORD_LENGTH = 3;

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

/** The one file in the user's Google Drive that holds the latest backup; each copy replaces it. */
export const DRIVE_BACKUP_FILE_NAME = 'gastos-respaldo.json';
/** At most one copy to Drive per day; the server only tries while it is awake. */
export const DRIVE_BACKUP_INTERVAL_HOURS = 24;
/**
 * Without a copy for this long while the app is being used, something is
 * wrong (a revoked permission, Google down): the home screen says so.
 */
export const DRIVE_BACKUP_STALE_HOURS = 72;
/** Why the last copy to Drive failed. The frontend maps each one to a Spanish message. */
export const DRIVE_BACKUP_ERRORS = ['not_authorized', 'unavailable'] as const;
export type DriveBackupError = (typeof DRIVE_BACKUP_ERRORS)[number];

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
