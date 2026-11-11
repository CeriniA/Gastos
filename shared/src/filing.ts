import type { FiledAmount } from './schemas/report';
import type { Transaction } from './schemas/transaction';

/** For callers that do not know the products of the list: their lines stay in the category of the whole. */
export const NO_PRODUCT_CATEGORIES: ReadonlyMap<string, string> = new Map();

export type Filable = Pick<
  Transaction,
  'id' | 'date' | 'type' | 'refund' | 'currency' | 'amountCents' | 'categoryId' | 'items'
>;

/**
 * The parts a transaction is filed in: each line goes to the
 * category of its product, or to its own; what the lines do not cover (a
 * discount, a tax, a line nobody read) stays in the category of the whole
 * transaction, so the total never changes. Without lines, all of it goes there.
 */
export function filingParts(
  transaction: Pick<Filable, 'type' | 'amountCents' | 'categoryId' | 'items'>,
  productCategories: ReadonlyMap<string, string>,
): { categoryId: string | null; amountCents: number }[] {
  const lines =
    transaction.type === 'expense'
      ? transaction.items.flatMap((item) => {
          const categoryId = item.productId ? productCategories.get(item.productId) : item.categoryId;
          return categoryId ? [{ categoryId, amountCents: item.amountCents }] : [];
        })
      : [];
  const rest = transaction.amountCents - lines.reduce((sum, line) => sum + line.amountCents, 0);
  const remainder = { categoryId: transaction.categoryId, amountCents: rest };
  return lines.length === 0 || rest !== 0 ? [...lines, remainder] : lines;
}

/**
 * What a transaction adds to each category it is filed under. A refund takes
 * away. A transfer adds nothing. `productCategories` says the category of each
 * product of the list.
 */
export function filedAmounts(
  transaction: Filable,
  productCategories: ReadonlyMap<string, string> = NO_PRODUCT_CATEGORIES,
): FiledAmount[] {
  if (transaction.type === 'transfer') return [];
  const { type: kind, currency } = transaction;
  const sign = transaction.refund ? -1 : 1;
  const parts = filingParts(transaction, productCategories);
  return parts.map((part) => ({
    transactionId: transaction.id,
    date: transaction.date,
    kind,
    currency,
    categoryId: part.categoryId,
    cents: sign * part.amountCents,
  }));
}
