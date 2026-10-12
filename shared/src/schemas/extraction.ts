import { z } from 'zod';
import { DOCUMENT_KINDS, MAX_DOCUMENT_TRANSACTIONS, TEXT_LIMITS, TRANSACTION_TYPES } from '../constants';
import { currencyCodeSchema, isoDateSchema, objectIdSchema } from './common';
import { MAX_TRANSACTION_ITEMS, transactionItemSchema } from './transaction';

/**
 * Contract between the app and whatever AI reads a document.
 * DRAFT v0: to be adjusted against real receipts and screenshots (run
 * `npm run try-extraction -w backend`) before it is considered stable.
 *
 * Every field the model may fail to read is nullable: a missing value becomes
 * a flagged field in the review screen, never a guess.
 */
/** What the AI may add as remarks about a document. */
export const MAX_WARNINGS = 50;
export const MAX_WARNING_LENGTH = 300;

/** Fields the review screen can flag as doubtful. */
export const UNCERTAIN_FIELDS = [
  'type',
  'date',
  'amount',
  'currency',
  'merchant',
  'category',
  'installment',
] as const;
export type UncertainField = (typeof UNCERTAIN_FIELDS)[number];

/** A line of a receipt as the AI reads it: the same shape a transaction stores. */
export const extractedItemSchema = transactionItemSchema;

export const extractedTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  /** Money given back for an earlier purchase. Only an expense can be one. */
  refund: z.boolean(),
  date: isoDateSchema.nullable(),
  amountCents: z.number().int().positive().nullable(),
  /** The currency printed on the document. It may be one the app has no accounts in (BRL, EUR). */
  currency: currencyCodeSchema.nullable(),
  merchant: z.string().max(TEXT_LIMITS.description),
  description: z.string().max(TEXT_LIMITS.description),
  /** Must be one of the user's existing categories; the model cannot invent one. */
  suggestedCategoryId: objectIdSchema.nullable(),
  installment: z.object({ number: z.number().int().min(1), total: z.number().int().min(1) }).nullable(),
  items: z.array(extractedItemSchema).max(MAX_TRANSACTION_ITEMS),
  uncertainFields: z.array(z.enum(UNCERTAIN_FIELDS)).max(UNCERTAIN_FIELDS.length),
});
export type ExtractedTransaction = z.infer<typeof extractedTransactionSchema>;

export const extractedStatementSchema = z.object({
  closingDate: isoDateSchema.nullable(),
  dueDate: isoDateSchema.nullable(),
  nextClosingDate: isoDateSchema.nullable(),
  nextDueDate: isoDateSchema.nullable(),
  totalCents: z.number().int().nullable(),
  minimumPaymentCents: z.number().int().nullable(),
  currency: currencyCodeSchema.nullable(),
});
export type ExtractedStatement = z.infer<typeof extractedStatementSchema>;

export const extractionResultSchema = z.object({
  documentKind: z.enum(DOCUMENT_KINDS),
  transactions: z.array(extractedTransactionSchema).max(MAX_DOCUMENT_TRANSACTIONS),
  /** Card statements only (stage 3). */
  statement: extractedStatementSchema.nullable(),
  warnings: z.array(z.string().max(MAX_WARNING_LENGTH)).max(MAX_WARNINGS),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * What the review screen works with: the extraction after the user's own
 * rules were applied to it.
 */
export interface ReviewTransaction extends ExtractedTransaction {
  /** True when the category comes from a "this merchant goes here" rule, not from the model. */
  categoryFromRule: boolean;
}

export interface ReviewExtraction extends Omit<ExtractionResult, 'transactions'> {
  transactions: ReviewTransaction[];
}
