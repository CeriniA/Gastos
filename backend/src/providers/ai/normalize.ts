import { z } from 'zod';
import {
  MAX_DOCUMENT_TRANSACTIONS,
  MAX_INSTALLMENTS,
  MAX_ITEM_QUANTITY,
  MAX_TRANSACTION_ITEMS,
  MAX_WARNINGS,
  MAX_WARNING_LENGTH,
  PRODUCT_GROUPS,
  TEXT_LIMITS,
  TRANSACTION_TYPES,
  UNCERTAIN_FIELDS,
  parseAmountToCents,
  parseFlexibleDate,
  type DocumentKind,
  type ExtractedStatement,
  type ExtractedTransaction,
  type ExtractionResult,
  type UncertainField,
} from '@gastos/shared';
import { extractionFailure, type ExtractionCategory } from './aiExtractor';

/**
 * Turns whatever text a model answered into a valid ExtractionResult, or
 * fails. Shared by every provider: models differ, the cleaning does not.
 *
 * It is deliberately forgiving about form (code fences, numbers as text,
 * missing fields) and strict about meaning: anything that cannot be trusted
 * becomes null plus a flag, never a guess.
 */

const looseAmount = z.union([z.string(), z.number()]).nullish();

const rawSchema = z.object({
  transactions: z
    .array(
      z
        .object({
          type: z.string().nullish(),
          refund: z.boolean().nullish(),
          financialCharge: z.boolean().nullish(),
          date: z.string().nullish(),
          amount: looseAmount,
          currency: z.string().nullish(),
          merchant: z.string().nullish(),
          description: z.string().nullish(),
          categoryId: z.string().nullish(),
          installmentNumber: z.number().nullish(),
          installmentTotal: z.number().nullish(),
          incoming: z.boolean().nullish(),
          items: z
            .array(
              z
                .object({
                  name: z.string().nullish(),
                  amount: looseAmount,
                  product: z.string().nullish(),
                  group: z.string().nullish(),
                  quantity: z.union([z.string(), z.number()]).nullish(),
                })
                .passthrough(),
            )
            .nullish(),
          uncertain: z.array(z.string()).nullish(),
        })
        .passthrough(),
    )
    .nullish(),
  statement: z
    .object({
      closingDate: z.string().nullish(),
      dueDate: z.string().nullish(),
      nextClosingDate: z.string().nullish(),
      nextDueDate: z.string().nullish(),
      total: looseAmount,
      minimumPayment: looseAmount,
      currency: z.string().nullish(),
      fromDate: z.string().nullish(),
      toDate: z.string().nullish(),
      openingBalance: looseAmount,
      closingBalance: looseAmount,
    })
    .passthrough()
    .nullish(),
  warnings: z.array(z.string()).nullish(),
});

type RawStatement = NonNullable<z.infer<typeof rawSchema>['statement']>;

/** Models sometimes wrap the JSON in a code fence or add a sentence around it. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw extractionFailure('unreadable', 'The model did not answer with JSON');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw extractionFailure('unreadable', 'The model answered with malformed JSON');
  }
}

function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cents = parseAmountToCents(value);
  return cents !== null && cents !== 0 ? Math.abs(cents) : null;
}

/** A balance keeps its sign (an overdrawn account) and may be zero. */
function toSignedCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  return parseAmountToCents(value);
}

/** "2", "1,5" or 0.75: units, kilos or litres. Anything else is unknown. */
function toQuantity(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const quantity = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'));
  return Number.isFinite(quantity) && quantity > 0 && quantity <= MAX_ITEM_QUANTITY ? quantity : null;
}

/** Any ISO code is kept: a receipt in reais is still a readable receipt. */
function toCurrency(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

const toDate = (value: string | null | undefined) => (value ? parseFlexibleDate(value) : null);

/**
 * A statement's own dates and amounts. Unlike a purchase, its due date and the
 * next closing are in the future, so future dates are kept here.
 */
function toStatement(raw: RawStatement | null | undefined): ExtractedStatement | null {
  if (!raw) return null;
  return {
    closingDate: toDate(raw.closingDate),
    dueDate: toDate(raw.dueDate),
    nextClosingDate: toDate(raw.nextClosingDate),
    nextDueDate: toDate(raw.nextDueDate),
    totalCents: toCents(raw.total),
    minimumPaymentCents: toCents(raw.minimumPayment),
    currency: toCurrency(raw.currency),
  };
}

/** An account's statement: the days it covers and its balances at the start and end. */
function toAccountStatement(raw: RawStatement | null | undefined): ExtractedStatement | null {
  if (!raw) return null;
  return {
    closingDate: null,
    dueDate: null,
    nextClosingDate: null,
    nextDueDate: null,
    totalCents: null,
    minimumPaymentCents: null,
    currency: toCurrency(raw.currency),
    fromDate: toDate(raw.fromDate),
    toDate: toDate(raw.toDate),
    openingBalanceCents: toSignedCents(raw.openingBalance),
    closingBalanceCents: toSignedCents(raw.closingBalance),
  };
}

const STATEMENT_READERS: Partial<
  Record<DocumentKind, (raw: RawStatement | null | undefined) => ExtractedStatement | null>
> = {
  card_statement: toStatement,
  account_statement: toAccountStatement,
};

function oneOf<T extends string>(values: readonly T[], candidate: string | null | undefined): T | null {
  const normalised = (candidate ?? '').trim();
  return values.find((value) => value.toLowerCase() === normalised.toLowerCase()) ?? null;
}

export function normalizeExtraction(
  answer: string,
  context: { kind: DocumentKind; categories: readonly ExtractionCategory[]; today: string },
): ExtractionResult {
  const parsed = rawSchema.safeParse(extractJson(answer));
  if (!parsed.success)
    throw extractionFailure('unreadable', 'The model answered with an unexpected structure');

  const categoryKinds = new Map(context.categories.map((category) => [category.id, category.kind]));
  const warnings = (parsed.data.warnings ?? []).map((warning) => warning.slice(0, MAX_WARNING_LENGTH));
  const transactions: ExtractedTransaction[] = [];

  for (const raw of parsed.data.transactions ?? []) {
    const type = oneOf(TRANSACTION_TYPES, raw.type);
    if (!type) {
      warnings.push('Se descartó un movimiento porque no se pudo determinar si era ingreso o egreso.');
      continue;
    }
    const uncertain = new Set<UncertainField>();
    for (const field of raw.uncertain ?? []) {
      const known = oneOf(UNCERTAIN_FIELDS, field);
      if (known) uncertain.add(known);
    }

    let date = toDate(raw.date);
    if (date && date > context.today) date = null; // A future date on a receipt is a misread.
    if (!date) uncertain.add('date');

    const amountCents = toCents(raw.amount);
    if (amountCents === null) uncertain.add('amount');

    const currency = toCurrency(raw.currency);
    if (!currency) uncertain.add('currency');

    // The model may only pick an existing category of the right kind.
    const suggestedCategoryId =
      type !== 'transfer' && raw.categoryId && categoryKinds.get(raw.categoryId) === type
        ? raw.categoryId
        : null;

    const number = raw.installmentNumber;
    const total = raw.installmentTotal;
    const validInstallment =
      Number.isInteger(number) &&
      Number.isInteger(total) &&
      number! >= 1 &&
      total! >= number! &&
      total! <= MAX_INSTALLMENTS;
    if (!validInstallment && (number || total)) uncertain.add('installment');

    transactions.push({
      type,
      refund: type === 'expense' && raw.refund === true,
      financialCharge: type === 'expense' && raw.financialCharge === true,
      date,
      amountCents,
      currency,
      merchant: (raw.merchant ?? '').trim().slice(0, TEXT_LIMITS.description),
      description: (raw.description ?? '').trim().slice(0, TEXT_LIMITS.description),
      suggestedCategoryId,
      installment: validInstallment ? { number: number!, total: total! } : null,
      ...(context.kind === 'account_statement'
        ? { incoming: type === 'transfer' && raw.incoming === true }
        : {}),
      items: (raw.items ?? [])
        .flatMap((item) => {
          const name = (item.name ?? '').trim().slice(0, TEXT_LIMITS.description);
          const itemCents = toCents(item.amount);
          if (name === '' || itemCents === null) return [];
          return [
            {
              name,
              amountCents: itemCents,
              product: (item.product ?? '').trim().slice(0, TEXT_LIMITS.product),
              group: oneOf(PRODUCT_GROUPS, item.group),
              quantity: toQuantity(item.quantity),
            },
          ];
        })
        .slice(0, MAX_TRANSACTION_ITEMS),
      uncertainFields: [...uncertain],
    });
  }

  return {
    documentKind: context.kind,
    transactions: transactions.slice(0, MAX_DOCUMENT_TRANSACTIONS),
    statement: STATEMENT_READERS[context.kind]?.(parsed.data.statement) ?? null,
    warnings: warnings.slice(0, MAX_WARNINGS),
  };
}
