import { z } from 'zod';
import {
  MAX_ITEM_QUANTITY,
  MAX_RATE,
  MAX_TAGS,
  PRODUCT_GROUPS,
  TEXT_LIMITS,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
  type Currency,
  type TransactionSource,
  type TransactionStatus,
  type TransactionType,
} from '../constants';
import {
  amountCentsSchema,
  currencyCodeSchema,
  currencySchema,
  isoDateSchema,
  monthKeySchema,
  objectIdSchema,
  paginationQuerySchema,
  queryBooleanSchema,
} from './common';

/**
 * What a receipt said when it was in another currency: the printed amount, its
 * currency, and the rate used to bring it to the account's currency. Kept for
 * reference; reports only use the transaction's own amount.
 */
export const originalAmountSchema = z.object({
  amountCents: amountCentsSchema,
  currency: currencyCodeSchema,
  /** Units of the account's currency per one unit of the original currency. */
  rate: z.number().positive().max(MAX_RATE),
});
export type OriginalAmount = z.infer<typeof originalAmountSchema>;

/**
 * One purchased line of a transaction. `name` is what the receipt prints (or
 * what the user typed); `product` and `group` say what it is, so that the
 * same thing bought in different shops adds up. The three extra fields
 * default to "unknown", which is also how lines stored before they existed
 * are read. The amount may be negative: a discount is a line too.
 */
export const transactionItemSchema = z.object({
  name: z.string().trim().max(TEXT_LIMITS.description),
  amountCents: z.number().int(),
  /** Generic name without brand or size, e.g. "Yerba". Empty when unknown. */
  product: z.string().trim().max(TEXT_LIMITS.product).default(''),
  group: z.enum(PRODUCT_GROUPS).nullable().default(null),
  /** Units, kilos or litres. Null when unknown. */
  quantity: z.number().positive().max(MAX_ITEM_QUANTITY).nullable().default(null),
  /** The product of the list this line is, once it was matched. Null while only `product` says it. */
  productId: objectIdSchema.nullable().default(null),
  /** The line's own category, for a line without a product. Null: it follows its product or the payment. */
  categoryId: objectIdSchema.nullable().default(null),
});
export type TransactionItem = z.infer<typeof transactionItemSchema>;

/** How many products a transaction can list. */
export const MAX_TRANSACTION_ITEMS = 200;

const fields = {
  type: z.enum(TRANSACTION_TYPES),
  /**
   * An expense that gives money back (a returned purchase, a credit on the
   * card): stored with a positive amount, it takes away from its category,
   * the month's spending and the card's statement instead of adding.
   */
  refund: z.boolean(),
  /** Day the purchase or income happened. */
  date: isoDateSchema,
  amountCents: amountCentsSchema,
  currency: currencySchema,
  accountId: objectIdSchema,
  categoryId: objectIdSchema.nullable(),
  /** Where it was spent, from the merchants list. Expenses only. */
  merchantId: objectIdSchema.nullable(),
  description: z.string().trim().max(TEXT_LIMITS.description),
  note: z.string().trim().max(TEXT_LIMITS.note),
  tagIds: z.array(objectIdSchema).max(MAX_TAGS),
  /** Transfers only. */
  toAccountId: objectIdSchema.nullable(),
  /** Transfers between accounts of different currencies only. */
  toAmountCents: amountCentsSchema.nullable(),
  /**
   * Optional override, honoured for credit card accounts only. Everything
   * else is paid the day it happens. See resolvePaymentDate in the backend.
   */
  paymentDate: isoDateSchema.nullable(),
  /** Set when the receipt was in a currency other than the account's. */
  original: originalAmountSchema.nullable(),
  /** What was bought, line by line. Optional, and not required to add up to the amount. */
  items: z.array(transactionItemSchema).max(MAX_TRANSACTION_ITEMS),
};

export interface TransactionShape {
  type: TransactionType;
  refund: boolean;
  amountCents: number;
  accountId: string;
  categoryId: string | null;
  merchantId: string | null;
  toAccountId: string | null;
  toAmountCents: number | null;
  items: readonly unknown[];
}

/**
 * Rules that involve more than one field. Used by the create schema and again
 * by the backend after merging an update into the stored transaction.
 */
export function transactionShapeIssues(tx: TransactionShape): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (tx.refund && tx.type !== 'expense') {
    issues.push({ path: 'refund', message: 'Only an expense can be a refund' });
  }
  if (tx.type === 'transfer') {
    if (!tx.toAccountId) {
      issues.push({ path: 'toAccountId', message: 'A transfer needs a destination account' });
    } else if (tx.toAccountId === tx.accountId) {
      issues.push({ path: 'toAccountId', message: 'Origin and destination must differ' });
    }
    if (tx.categoryId) {
      issues.push({ path: 'categoryId', message: 'A transfer cannot have a category' });
    }
    if (tx.merchantId) {
      issues.push({ path: 'merchantId', message: 'A transfer cannot have a merchant' });
    }
    if (tx.items.length > 0) {
      issues.push({ path: 'items', message: 'A transfer cannot have products' });
    }
  } else {
    if (tx.toAccountId) {
      issues.push({ path: 'toAccountId', message: 'Only transfers have a destination account' });
    }
    if (tx.toAmountCents !== null) {
      issues.push({ path: 'toAmountCents', message: 'Only transfers have a destination amount' });
    }
  }
  return issues;
}

export const transactionCreateSchema = z
  .object({
    ...fields,
    refund: fields.refund.default(false),
    categoryId: fields.categoryId.default(null),
    merchantId: fields.merchantId.default(null),
    description: fields.description.default(''),
    note: fields.note.default(''),
    tagIds: fields.tagIds.default([]),
    toAccountId: fields.toAccountId.default(null),
    toAmountCents: fields.toAmountCents.default(null),
    paymentDate: fields.paymentDate.default(null),
    original: fields.original.default(null),
    items: fields.items.default([]),
  })
  .superRefine((value, context) => {
    for (const issue of transactionShapeIssues(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.path], message: issue.message });
    }
  });
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

/** Partial update. The backend re-checks the merged result. */
export const transactionUpdateSchema = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

export const transactionListQuerySchema = paginationQuerySchema.extend({
  /** Month of the payment date, which is what the monthly balance uses. */
  month: monthKeySchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  accountId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  tagId: objectIdSchema.optional(),
  source: z.enum(TRANSACTION_SOURCES).optional(),
  q: z.string().trim().max(100).optional(),
  /** true lists the trash instead of live transactions. */
  deleted: queryBooleanSchema.optional(),
});
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

export const summaryQuerySchema = z.object({ month: monthKeySchema });

export const lastRateQuerySchema = z.object({ currency: currencyCodeSchema });

/** The most recent rate the user applied to a currency, to start the next conversion from. */
export interface LastRate {
  rate: number | null;
  date: string | null;
}

export interface Installment {
  /** Null until the installment-plans module links it (stage 3). */
  planId: string | null;
  number: number;
  total: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  source: TransactionSource;
  date: string;
  /** Day the money actually leaves or enters. Drives the monthly balance. */
  paymentDate: string;
  amountCents: number;
  /** An expense that gives money back: its amount takes away instead of adding. */
  refund: boolean;
  currency: Currency;
  original: OriginalAmount | null;
  accountId: string;
  toAccountId: string | null;
  toAmountCents: number | null;
  categoryId: string | null;
  merchantId: string | null;
  description: string;
  note: string;
  tagIds: string[];
  items: TransactionItem[];
  installment: Installment | null;
  documentId: string | null;
  cardPeriodId: string | null;
  recurringId: string | null;
  /** True once a transaction that came from a document or import was changed by hand. */
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CurrencyTotals {
  currency: Currency;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

export interface MonthSummary {
  month: string;
  totals: CurrencyTotals[];
}
