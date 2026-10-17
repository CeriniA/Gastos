import { z } from 'zod';
import { PRODUCT_GROUPS, TEXT_LIMITS, type ProductGroup } from '../constants';
import { nameKey } from '../text';
import type { TransactionItem } from './transaction';

/**
 * "This line of a receipt is this product." The receipt prints the same text
 * every time ("YERB.PLAY 1000"), so a product or group the user corrected
 * once is offered for the same line on the next receipts. Like a category
 * rule, it is only a suggestion: the review still shows it and the user can
 * change it.
 */
export const productRuleInputSchema = z.object({
  /** The line as printed on the receipt. */
  name: z.string().trim().min(1).max(TEXT_LIMITS.description),
  product: z.string().trim().max(TEXT_LIMITS.product),
  group: z.enum(PRODUCT_GROUPS).nullable(),
});
export type ProductRuleInput = z.infer<typeof productRuleInputSchema>;

export interface ProductRule extends ProductRuleInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The products the user corrected while reviewing a receipt: the lines kept
 * with the same printed text as one the AI read, but with another product or
 * group. One per printed text; a line left as it was read is not a correction.
 */
export function productCorrections(
  read: readonly TransactionItem[],
  kept: readonly TransactionItem[],
): ProductRuleInput[] {
  const readByName = new Map(read.map((item) => [nameKey(item.name), item]));
  const corrections = new Map<string, ProductRuleInput>();
  for (const item of kept) {
    const key = nameKey(item.name);
    const original = readByName.get(key);
    if (!original || key === '') continue;
    const changed = original.product !== item.product || original.group !== item.group;
    if (changed) corrections.set(key, { name: item.name, product: item.product, group: item.group });
  }
  return [...corrections.values()];
}

/** A rule's product and group for the line it matches, or the line as it was. */
export function applyProductRule<T extends { name: string; product: string; group: ProductGroup | null }>(
  item: T,
  rules: ReadonlyMap<string, Pick<ProductRuleInput, 'product' | 'group'>>,
): T {
  const rule = rules.get(nameKey(item.name));
  return rule ? { ...item, product: rule.product, group: rule.group } : item;
}
