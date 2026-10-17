import { z } from 'zod';
import {
  MAX_DOCUMENT_FILES,
  MAX_PDF_PASSWORD_LENGTH,
  MAX_STATEMENT_PERIODS,
  MAX_STATEMENT_TEXT_LENGTH,
  STATEMENT_KINDS,
  type StatementFileType,
  UPLOADABLE_DOCUMENT_KINDS,
  type DocumentErrorCode,
  type DocumentKind,
  type DocumentStatus,
  MAX_DOCUMENT_TRANSACTIONS,
  MAX_INSTALLMENTS,
  TEXT_LIMITS,
} from '../constants';
import { cardPeriodCreateSchema } from './cardPeriod';
import { categoryRuleInputSchema } from './categoryRule';
import { objectIdSchema } from './common';
import type { ReviewExtraction } from './extraction';
import { transactionCreateSchema } from './transaction';

/** A multipart text field left empty means it was not given. */
const emptyAsMissing = (value: unknown) => (value === '' ? undefined : value);

/** Optional: the account the review screen starts with. */
const startingAccountSchema = z.preprocess(emptyAsMissing, objectIdSchema.optional());

/** Text fields that travel next to the files in the multipart upload. */
export const documentUploadSchema = z.object({
  kind: z.enum(UPLOADABLE_DOCUMENT_KINDS),
  accountId: startingAccountSchema,
});
export type DocumentUpload = z.infer<typeof documentUploadSchema>;

/** The text field next to a card statement's PDF, when the bank protects it with a password. */
export const statementPreviewSchema = z.object({
  password: z.preprocess(emptyAsMissing, z.string().max(MAX_PDF_PASSWORD_LENGTH).optional()),
});

/**
 * A card statement's text as the server extracted it from the PDF, with the
 * personal data it recognised already hidden. Nothing is stored yet.
 */
export interface StatementPreview {
  text: string;
  /** Pages of a PDF, sheets of an Excel file, 1 for a CSV. */
  pages: number;
  fileType: StatementFileType;
  /** How many pieces of personal data were hidden. */
  hidden: number;
}

/** The statement's text as the user approved it: the only thing that is stored and sent to the AI. */
export const statementUploadSchema = z.object({
  /** A credit card's statement, or any other account's (bank, MercadoPago, an app). */
  kind: z.enum(STATEMENT_KINDS).default('card_statement'),
  text: z.string().trim().min(1).max(MAX_STATEMENT_TEXT_LENGTH),
  /** The PDF's name, so the pending tray can tell statements apart. */
  fileName: z.string().trim().max(TEXT_LIMITS.description).default(''),
  accountId: startingAccountSchema,
});
export type StatementUpload = z.infer<typeof statementUploadSchema>;

export const documentListQuerySchema = z.object({
  /** pending: everything still waiting for the AI or for the user. */
  status: z.enum(['pending', 'all']).default('pending'),
});

/** One transaction as the user left it in the review screen. */
export const documentConfirmEntrySchema = z
  .object({
    /** Carries its products in `items`, already in the account's currency. */
    transaction: transactionCreateSchema,
    installment: z
      .object({ number: z.number().int().min(1), total: z.number().int().min(1).max(MAX_INSTALLMENTS) })
      .refine((value) => value.number <= value.total, 'Installment number exceeds the total')
      .nullable()
      .default(null),
    /**
     * For an installment of a purchase the app does not have ("cuota 3 de 6"):
     * also create its plan with the installments still to come.
     */
    continuePlan: z.boolean().default(false),
  })
  .refine(
    (value) =>
      !value.continuePlan || (value.installment && value.installment.number < value.installment.total),
    {
      message: 'There are no installments left to create',
      path: ['continuePlan'],
    },
  );

export const documentConfirmSchema = z.object({
  transactions: z.array(documentConfirmEntrySchema).min(1).max(MAX_DOCUMENT_TRANSACTIONS),
  /** Merchant rules the user agreed to remember while reviewing. */
  rules: z.array(categoryRuleInputSchema).max(100).default([]),
  /** Closing and due dates read from a card statement that the user chose to keep. */
  cardPeriods: z.array(cardPeriodCreateSchema).max(MAX_STATEMENT_PERIODS).default([]),
});
export type DocumentConfirm = z.infer<typeof documentConfirmSchema>;

export const documentDeleteQuerySchema = z.object({
  /** What happens to the transactions of a confirmed document. */
  transactions: z.enum(['keep', 'delete']).default('keep'),
});

export const documentFileParamsSchema = z.object({
  id: objectIdSchema,
  index: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_DOCUMENT_FILES - 1),
});

export interface DocumentSummary {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  fileName: string;
  /** Images still stored. Zero once the document is confirmed, and always for a card statement. */
  fileCount: number;
  accountId: string | null;
  errorCode: DocumentErrorCode | null;
  /**
   * Set while the document waits for the AI to have room again (out of quota
   * or down): when it will be tried on its own. Its status stays processing.
   */
  retryAt: string | null;
  /** Automatic retries so far, after the AI was out of quota or down. */
  waits: number;
  /** How many transactions the AI found. Null while processing. */
  transactionCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Why an extracted transaction looks like a repeat:
 * existing: a stored transaction has the same date and amount, or is already
 *   that installment ("3 of 6") for the same amount;
 * repeated: an earlier transaction of this same document has them too.
 */
export type DuplicateHint = 'existing' | 'repeated' | null;

export interface DocumentDetail extends DocumentSummary {
  extraction: ReviewExtraction | null;
  /** A card statement's text, as sent to the AI. Null for images, and once confirmed. */
  text: string | null;
  /** One entry per extracted transaction, worked out each time the document is opened. */
  duplicateHints: DuplicateHint[];
  promptVersion: number | null;
}

export interface DocumentConfirmResult {
  created: number;
}
