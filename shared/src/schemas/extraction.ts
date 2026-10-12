import { z } from 'zod';
import { DOCUMENT_KINDS, PRODUCT_GROUPS, TRANSACTION_TYPES } from '../constants';
import { currencyCodeSchema, isoDateSchema, objectIdSchema } from './common';

/**
 * Contract between the app and whatever AI reads a document.
 * DRAFT v0: to be adjusted against real receipts and screenshots (run
 * `npm run try-extraction -w backend`) before it is considered stable.
 *
 * Every field the model may fail to read is nullable: a missing value becomes
 * a flagged field in the review screen, never a guess.
 */
export const EXTRACTION_CONTRACT_VERSION = 0;

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

/**
 * One purchased line of a receipt. `name` is what the receipt prints;
 * `product` and `group` are the AI's reading of what it is, so that the same
 * thing bought in different shops adds up. The three extra fields default to
 * "unknown", which is also how lines stored before they existed are read.
 */
export const extractedItemSchema = z.object({
  name: z.string().max(200),
  amountCents: z.number().int(),
  /** Generic name without brand or size, e.g. "Yerba". Empty when unknown. */
  product: z.string().max(80).default(''),
  group: z.enum(PRODUCT_GROUPS).nullable().default(null),
  /** Units, kilos or litres as printed. Null when the receipt does not say. */
  quantity: z.number().positive().max(100_000).nullable().default(null),
});
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const extractedTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  date: isoDateSchema.nullable(),
  amountCents: z.number().int().positive().nullable(),
  /** The currency printed on the document. It may be one the app has no accounts in (BRL, EUR). */
  currency: currencyCodeSchema.nullable(),
  merchant: z.string().max(200),
  description: z.string().max(200),
  /** Must be one of the user's existing categories; the model cannot invent one. */
  suggestedCategoryId: objectIdSchema.nullable(),
  installment: z.object({ number: z.number().int().min(1), total: z.number().int().min(1) }).nullable(),
  items: z.array(extractedItemSchema).max(200),
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
  transactions: z.array(extractedTransactionSchema).max(500),
  /** Card statements only (stage 3). */
  statement: extractedStatementSchema.nullable(),
  warnings: z.array(z.string().max(300)).max(50),
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
