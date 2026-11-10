import type { FiledAmount, Split, Transaction } from '@gastos/shared';

export type Filable = Pick<
  Transaction,
  'id' | 'date' | 'type' | 'refund' | 'currency' | 'amountCents' | 'categoryId' | 'splits' | 'items'
>;

/**
 * The parts a transaction is filed in. A divided one files each part under its
 * own category (until divisions become lines). Otherwise each line goes to the
 * category of its product, or to its own; what the lines do not cover (a
 * discount, a tax, a line nobody read) stays in the category of the whole
 * transaction, so the total never changes. Without lines, all of it goes there.
 */
function partsOf(
  transaction: Filable,
  productCategories: ReadonlyMap<string, string>,
): { categoryId: string | null; amountCents: number }[] {
  if (transaction.splits.length > 0) return transaction.splits;
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
  productCategories: ReadonlyMap<string, string> = new Map(),
): FiledAmount[] {
  if (transaction.type === 'transfer') return [];
  const { type: kind, currency } = transaction;
  const sign = transaction.refund ? -1 : 1;
  const parts = partsOf(transaction, productCategories);
  return parts.map((part) => ({
    transactionId: transaction.id,
    date: transaction.date,
    kind,
    currency,
    categoryId: part.categoryId,
    cents: sign * part.amountCents,
  }));
}

/** How a transaction is filed: under one category, or divided between several. */
export interface Filing {
  categoryId: string | null;
  splits: Split[];
}

/**
 * Parts of a divided transaction that ended up in the same category (two
 * categories were merged) become one part, their amounts added. If a single
 * part is left, the transaction is no longer divided: that is its category.
 * Returns null when no two parts share a category, so there is nothing to change.
 */
export function joinSameCategory(splits: readonly Split[]): Filing | null {
  const totals = new Map<string, number>();
  for (const part of splits) {
    totals.set(part.categoryId, (totals.get(part.categoryId) ?? 0) + part.amountCents);
  }
  if (totals.size === splits.length) return null;
  const joined = [...totals].map(([categoryId, amountCents]) => ({ categoryId, amountCents }));
  const [only] = joined;
  return only && joined.length === 1
    ? { categoryId: only.categoryId, splits: [] }
    : { categoryId: null, splits: joined };
}
