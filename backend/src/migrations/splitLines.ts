/** A part of a divided transaction, as it was stored. */
export interface StoredSplit {
  categoryId: string;
  amountCents: number;
}

/** A line made from a part has no printed name: it only says how much goes to which category. */
const UNNAMED_LINE = '';

export interface LineOfSplit {
  name: string;
  amountCents: number;
  product: string;
  group: null;
  quantity: null;
  productId: null;
  categoryId: string;
}

/**
 * A divided transaction becomes a transaction with lines: each part is a line
 * without a product, with its amount and its own category, and the transaction
 * takes the category of the largest part (the first one if two are equal). The
 * parts added up to the total, so the lines do too, and the reports give the
 * same before and after. Lines the transaction already had stay, but no longer
 * point at a product or a category: they would count a second time.
 */
export function splitsToLines<T extends { productId?: unknown; categoryId?: unknown }>(
  splits: readonly StoredSplit[],
  items: readonly T[],
): { categoryId: string; items: (T | LineOfSplit)[] } {
  const largest = splits.reduce((top, part) => (part.amountCents > top.amountCents ? part : top));
  const kept = items.map((item) => ({ ...item, productId: null, categoryId: null }));
  const lines = splits.map(
    (part): LineOfSplit => ({
      name: UNNAMED_LINE,
      amountCents: part.amountCents,
      product: UNNAMED_LINE,
      group: null,
      quantity: null,
      productId: null,
      categoryId: part.categoryId,
    }),
  );
  return { categoryId: largest.categoryId, items: [...kept, ...lines] };
}
