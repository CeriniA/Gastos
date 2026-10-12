import { z } from 'zod';
import {
  UPLOADABLE_DOCUMENT_KINDS,
  type DocumentErrorCode,
  type DocumentKind,
  type DocumentStatus,
} from '../constants';
import { categoryRuleInputSchema } from './categoryRule';
import { objectIdSchema } from './common';
import type { ReviewExtraction } from './extraction';
import { transactionCreateSchema } from './transaction';

/** Text fields that travel next to the files in the multipart upload. */
export const documentUploadSchema = z.object({
  kind: z.enum(UPLOADABLE_DOCUMENT_KINDS),
  /** Optional: the account the review screen starts with. An empty field means none. */
  accountId: z.preprocess((value) => (value === '' ? undefined : value), objectIdSchema.optional()),
});
export type DocumentUpload = z.infer<typeof documentUploadSchema>;

export const documentListQuerySchema = z.object({
  /** pending: everything still waiting for the AI or for the user. */
  status: z.enum(['pending', 'all']).default('pending'),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

/** One transaction as the user left it in the review screen. */
export const documentConfirmEntrySchema = z.object({
  /** Carries its products in `items`, already in the account's currency. */
  transaction: transactionCreateSchema,
  installment: z
    .object({ number: z.number().int().min(1), total: z.number().int().min(1).max(120) })
    .refine((value) => value.number <= value.total, 'Installment number exceeds the total')
    .nullable()
    .default(null),
});

export const documentConfirmSchema = z.object({
  transactions: z.array(documentConfirmEntrySchema).min(1).max(500),
  /** Merchant rules the user agreed to remember while reviewing. */
  rules: z.array(categoryRuleInputSchema).max(100).default([]),
});
export type DocumentConfirm = z.infer<typeof documentConfirmSchema>;

export const documentDeleteQuerySchema = z.object({
  /** What happens to the transactions of a confirmed document. */
  transactions: z.enum(['keep', 'delete']).default('keep'),
});

export const documentFileParamsSchema = z.object({
  id: objectIdSchema,
  index: z.coerce.number().int().min(0).max(20),
});

export interface DocumentSummary {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  fileName: string;
  /** Images still stored. Zero once the document is confirmed. */
  fileCount: number;
  accountId: string | null;
  errorCode: DocumentErrorCode | null;
  /** How many transactions the AI found. Null while processing. */
  transactionCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Why an extracted transaction looks like a repeat:
 * existing: a stored transaction has the same date and amount;
 * repeated: an earlier transaction of this same document has them too.
 */
export type DuplicateHint = 'existing' | 'repeated' | null;

export interface DocumentDetail extends DocumentSummary {
  extraction: ReviewExtraction | null;
  /** One entry per extracted transaction, worked out each time the document is opened. */
  duplicateHints: DuplicateHint[];
  promptVersion: number | null;
}

export interface DocumentConfirmResult {
  created: number;
}
