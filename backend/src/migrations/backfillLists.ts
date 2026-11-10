import { findByPrintedText, type Merchant, type Product, TEXT_LIMITS } from '@gastos/shared';

/** What a stored transaction says in words, before it points at the lists. */
export interface TransactionText {
  type: string;
  description: string;
  merchantId: string | null;
  items: readonly { product?: string; productId?: string | null }[];
}

/** The fields to set so the transaction points at the lists; empty when it already does or nothing matches. */
export type ListLinks = Record<string, string>;

/**
 * The merchant a description names and the product each line names, looked up
 * in the lists the previous migration filled. Words that match nothing stay as
 * they are; what is already linked is never changed. Keys are the paths to set
 * in the stored transaction ("merchantId", "items.2.productId").
 */
export function linksFor(
  transaction: TransactionText,
  merchants: readonly Merchant[],
  products: readonly Product[],
): ListLinks {
  const links: ListLinks = {};
  if (transaction.type !== 'expense') return links;
  if (!transaction.merchantId && transaction.description.trim()) {
    const merchant = findByPrintedText(merchants, transaction.description.trim().slice(0, TEXT_LIMITS.name));
    if (merchant) links.merchantId = merchant.id;
  }
  transaction.items.forEach((item, index) => {
    if (item.productId || !item.product?.trim()) return;
    const product = findByPrintedText(products, item.product.trim().slice(0, TEXT_LIMITS.name));
    if (product) links[`items.${index}.productId`] = product.id;
  });
  return links;
}
