import { z } from 'zod';
import { CURRENCIES, DOCUMENT_KINDS, TRANSACTION_TYPES } from '../constants';
import { isoDateSchema, objectIdSchema } from './common';

/**
 * Contract between the app and whatever AI reads a document (stage 2).
 * DRAFT v0: field list agreed in design, to be adjusted against real receipts,
 * screenshots and statements before the Gemini provider is written.
 *
 * Every field the model may fail to read is nullable: a missing value becomes
 * a flagged field in the review screen, never a guess.
 */
export const EXTRACTION_CONTRACT_VERSION = 0;

export const extractedTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  date: isoDateSchema.nullable(),
  amountCents: z.number().int().positive().nullable(),
  currency: z.enum(CURRENCIES).nullable(),
  merchant: z.string().max(200),
  description: z.string().max(200),
  /** Must be one of the user's existing categories; the model cannot invent one. */
  suggestedCategoryId: objectIdSchema.nullable(),
  installment: z.object({ number: z.number().int().min(1), total: z.number().int().min(1) }).nullable(),
  items: z.array(z.object({ name: z.string().max(200), amountCents: z.number().int() })).max(200),
  /** Names of the fields the model was unsure about. */
  uncertainFields: z.array(z.string()).max(20),
});
export type ExtractedTransaction = z.infer<typeof extractedTransactionSchema>;

export const extractedStatementSchema = z.object({
  closingDate: isoDateSchema.nullable(),
  dueDate: isoDateSchema.nullable(),
  nextClosingDate: isoDateSchema.nullable(),
  nextDueDate: isoDateSchema.nullable(),
  totalCents: z.number().int().nullable(),
  minimumPaymentCents: z.number().int().nullable(),
  currency: z.enum(CURRENCIES).nullable(),
});
export type ExtractedStatement = z.infer<typeof extractedStatementSchema>;

export const extractionResultSchema = z.object({
  documentKind: z.enum(DOCUMENT_KINDS),
  transactions: z.array(extractedTransactionSchema).max(500),
  /** Card statements only. */
  statement: extractedStatementSchema.nullable(),
  warnings: z.array(z.string().max(300)).max(50),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
