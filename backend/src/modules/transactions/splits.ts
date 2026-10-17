import type { FiledAmount, Split, Transaction } from '@gastos/shared';

/**
 * What a transaction adds to each category it is filed under: all of it to its
 * category, or each part to its own. A refund takes away. A transfer adds nothing.
 */
export function filedAmounts(
  transaction: Pick<
    Transaction,
    'id' | 'date' | 'type' | 'refund' | 'currency' | 'amountCents' | 'categoryId' | 'splits'
  >,
): FiledAmount[] {
  if (transaction.type === 'transfer') return [];
  const { type: kind, currency } = transaction;
  const sign = transaction.refund ? -1 : 1;
  const parts =
    transaction.splits.length > 0
      ? transaction.splits
      : [{ categoryId: transaction.categoryId, amountCents: transaction.amountCents }];
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
