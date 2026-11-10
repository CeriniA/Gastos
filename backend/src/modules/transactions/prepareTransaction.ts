import {
  impliedRate,
  isFutureDay,
  transactionShapeIssues,
  type Account,
  type Category,
  type Installment,
  type IsoDate,
  type Merchant,
  type Product,
  type Transaction,
  type TransactionCreate,
  type TransactionSource,
  type TransactionStatus,
} from '@gastos/shared';
import { ValidationError } from '../../core/errors/errors';
import { dueDateFor, resolvePaymentDate, type PeriodDates } from './paymentDate';
import type { TransactionRecord } from './transactions.repository';

/** The lookups every validation needs, loaded once per operation. */
export interface References {
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  tagIds: Set<string>;
  merchants: Map<string, Merchant>;
  products: Map<string, Product>;
  /** Card statements per account. */
  periods: Map<string, PeriodDates[]>;
  today: IsoDate;
}

export interface Origin {
  source: TransactionSource;
  installment?: Installment | null;
  /** The uploaded document the transaction was read from. */
  documentId?: string;
  /** Future installments are stored as projected; everything else is confirmed. */
  status?: TransactionStatus;
  /** The card statement a transfer pays. */
  cardPeriodId?: string;
}

type Issue = { path: string; message: string };

const issue = (path: string, message: string): Issue => ({ path, message });

/** The account the money leaves, and the currency it is in. */
function accountIssues(input: TransactionCreate, refs: References, previous?: Transaction): Issue[] {
  const account = refs.accounts.get(input.accountId);
  if (!account) return [issue('accountId', 'Account does not exist')];
  const issues: Issue[] = [];
  if (account.archived && previous?.accountId !== account.id) {
    issues.push(issue('accountId', 'Account is archived'));
  }
  if (account.currency !== input.currency) {
    issues.push(issue('currency', 'Currency must match the account currency'));
  }
  return issues;
}

/** The destination of a transfer, and whether it needs a second amount. */
function transferIssues(input: TransactionCreate, refs: References): Issue[] {
  const account = refs.accounts.get(input.accountId);
  if (input.type !== 'transfer' || !input.toAccountId) return [];
  const destination = refs.accounts.get(input.toAccountId);
  if (!destination) return [issue('toAccountId', 'Destination account does not exist')];
  if (!account) return [];
  const crossCurrency = destination.currency !== account.currency;
  if (crossCurrency && input.toAmountCents === null) {
    return [issue('toAmountCents', 'A transfer between currencies needs both amounts')];
  }
  if (!crossCurrency && input.toAmountCents !== null) {
    return [issue('toAmountCents', 'Only transfers between currencies have a destination amount')];
  }
  return [];
}

function merchantIssues(input: TransactionCreate, refs: References, previous?: Transaction): Issue[] {
  if (!input.merchantId) return [];
  const merchant = refs.merchants.get(input.merchantId);
  if (input.type !== 'expense') return [issue('merchantId', 'Only an expense has a merchant')];
  if (!merchant) return [issue('merchantId', 'Merchant does not exist')];
  if (merchant.archived && previous?.merchantId !== merchant.id) {
    return [issue('merchantId', 'Merchant is archived')];
  }
  return [];
}

/** A line either is a product of the list, or has its own category. */
function itemIssues(
  input: TransactionCreate,
  refs: References,
  previous: Transaction | undefined,
  checkCategory: (categoryId: string, path: string) => void,
): Issue[] {
  const issues: Issue[] = [];
  const previousProductIds = new Set(previous?.items.map((item) => item.productId) ?? []);
  input.items.forEach((item, index) => {
    if (!item.productId) {
      if (item.categoryId) checkCategory(item.categoryId, `items.${index}.categoryId`);
      return;
    }
    const product = refs.products.get(item.productId);
    const path = `items.${index}.productId`;
    if (input.type !== 'expense') issues.push(issue(path, 'Only an expense has products'));
    else if (!product) issues.push(issue(path, 'Product does not exist'));
    else if (product.archived && !previousProductIds.has(product.id)) {
      issues.push(issue(path, 'Product is archived'));
    }
    if (item.categoryId) {
      issues.push(issue(`items.${index}.categoryId`, 'A line with a product takes the category of the product'));
    }
  });
  return issues;
}

/** The categories of the transaction, its splits and its lines, the merchant and the products. */
function listIssues(input: TransactionCreate, refs: References, previous?: Transaction): Issue[] {
  // A transfer with a category, merchant or products is already reported by the shape rules.
  if (input.type === 'transfer') return [];
  const issues: Issue[] = [];
  const previousCategoryIds = new Set(
    previous
      ? [
          previous.categoryId,
          ...previous.splits.map((split) => split.categoryId),
          ...previous.items.map((item) => item.categoryId),
        ]
      : [],
  );
  const checkCategory = (categoryId: string, path: string) => {
    const category = refs.categories.get(categoryId);
    if (!category) issues.push(issue(path, 'Category does not exist'));
    else if (category.kind !== input.type) issues.push(issue(path, 'Category is of a different kind'));
    else if (category.archived && !previousCategoryIds.has(categoryId)) {
      issues.push(issue(path, 'Category is archived'));
    }
  };
  if (input.categoryId) checkCategory(input.categoryId, 'categoryId');
  input.splits.forEach((split, index) => checkCategory(split.categoryId, `splits.${index}.categoryId`));
  // After the checks above: `checkCategory` adds to `issues` as the lines are visited.
  const merchant = merchantIssues(input, refs, previous);
  const lines = itemIssues(input, refs, previous, checkCategory);
  return [...issues, ...merchant, ...lines];
}

/** Rules about the date, the original amount and the tags. */
function detailIssues(input: TransactionCreate, refs: References, status: TransactionStatus): Issue[] {
  const issues: Issue[] = [];
  // Only projected items (future installments) may be dated ahead.
  if (isFutureDay(input.date, refs.today) && status !== 'projected') {
    issues.push(issue('date', 'Date cannot be in the future'));
  }
  if (input.original && input.original.currency === input.currency) {
    issues.push(issue('original', 'The original currency must differ from the account currency'));
  }
  if (input.tagIds.some((tagId) => !refs.tagIds.has(tagId))) {
    issues.push(issue('tagIds', 'Tag does not exist'));
  }
  return issues;
}

/** Where the transaction came from and what it is linked to: kept from before, unless the origin says otherwise. */
function provenance(type: TransactionCreate['type'], origin: Origin, previous?: Transaction) {
  return {
    installment: origin.installment === undefined ? (previous?.installment ?? null) : origin.installment,
    documentId: origin.documentId ?? previous?.documentId ?? null,
    // Only a transfer pays a statement: changed into something else, it lets go of it.
    cardPeriodId: type === 'transfer' ? (origin.cardPeriodId ?? previous?.cardPeriodId ?? null) : null,
    recurringId: previous?.recurringId ?? null,
    edited: previous ? previous.edited || previous.source !== 'manual' : false,
  };
}

/**
 * Checks an input against every business rule and returns what to store.
 * `previous` is the stored transaction on an update: references it already
 * had may stay even if they were archived since.
 */
export function prepareTransaction(
  input: TransactionCreate,
  refs: References,
  origin: Origin,
  previous?: Transaction,
): TransactionRecord {
  const status = origin.status ?? previous?.status ?? 'confirmed';
  const issues = [
    ...transactionShapeIssues(input),
    ...accountIssues(input, refs, previous),
    ...detailIssues(input, refs, status),
    ...transferIssues(input, refs),
    ...listIssues(input, refs, previous),
  ];
  const account = refs.accounts.get(input.accountId);
  if (issues.length > 0 || !account) throw new ValidationError('Invalid transaction', { issues });

  // The rate is never taken as typed: it is whatever links the two amounts.
  const original = input.original
    ? {
        ...input.original,
        rate: impliedRate(input.amountCents, input.original.amountCents) || input.original.rate,
      }
    : null;
  return {
    type: input.type,
    refund: input.refund,
    status,
    source: origin.source,
    date: input.date,
    paymentDate: resolvePaymentDate({
      date: input.date,
      accountType: account.type,
      requested: input.paymentDate,
      periodDueDate:
        account.type === 'credit_card' ? dueDateFor(refs.periods.get(account.id) ?? [], input.date) : null,
    }),
    amountCents: input.amountCents,
    currency: input.currency,
    original,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    toAmountCents: input.toAmountCents,
    categoryId: input.categoryId,
    merchantId: input.merchantId,
    description: input.description,
    note: input.note,
    tagIds: [...new Set(input.tagIds)],
    splits: input.splits,
    items: input.items,
    ...provenance(input.type, origin, previous),
  };
}
