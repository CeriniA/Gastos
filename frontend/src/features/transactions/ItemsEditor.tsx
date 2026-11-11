import {
  MAX_TRANSACTION_ITEMS,
  centsToDecimalString,
  formatMoney,
  parseAmountToCents,
  sumCents,
  transactionItemSchema,
  type Category,
  type Product,
  type ProductGroup,
  type TransactionItem,
  TEXT_LIMITS,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { Button, Select, TextInput } from '../../shared/ui/ui';
import { optionLabel } from '../categories/tree';

/** One product line as it is being typed: everything is text until it is saved. */
export interface ItemDraft {
  /** As printed on the receipt; for a line typed by hand, the same as the product. */
  name: string;
  product: string;
  /** The old product group: not chosen any more, but kept on the lines that have one. */
  group: ProductGroup | '';
  /** The product of the list this line is; empty when it is none. */
  productId: string;
  /** The line's own category; only used when it has no product. */
  categoryId: string;
  quantity: string;
  amount: string;
}

const EMPTY_ITEM: ItemDraft = { name: '', product: '', group: '', productId: '', categoryId: '', quantity: '', amount: '' };

export function toItemDrafts(items: readonly TransactionItem[]): ItemDraft[] {
  return items.map((item) => ({
    name: item.name,
    product: item.product,
    group: item.group ?? '',
    productId: item.productId ?? '',
    categoryId: item.categoryId ?? '',
    quantity: item.quantity === null ? '' : String(item.quantity).replace('.', ','),
    amount: centsToDecimalString(item.amountCents),
  }));
}

/** The typed quantity (comma or dot as decimal mark), null when empty. */
function parseQuantity(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  return clean ? Number(clean) : null;
}

/** One typed line as a line to save, 'blank' when nothing was typed, 'incomplete' when it cannot be saved. */
function readDraft(draft: ItemDraft): TransactionItem | 'blank' | 'incomplete' {
  // A line may have no text if the list or a category says what it is.
  const named = Boolean(draft.product.trim() || draft.name.trim() || draft.productId || draft.categoryId);
  if (!named && !draft.amount.trim()) return 'blank';
  const amountCents = parseAmountToCents(draft.amount);
  const parsed = transactionItemSchema.safeParse({
    name: draft.name.trim() || draft.product.trim(),
    product: draft.product,
    group: draft.group || null,
    productId: draft.productId || null,
    categoryId: draft.productId ? null : draft.categoryId || null,
    quantity: parseQuantity(draft.quantity),
    amountCents,
  });
  const hasAmount = amountCents !== null && amountCents !== 0;
  return named && hasAmount && parsed.success ? parsed.data : 'incomplete';
}

/**
 * Turns the typed lines into products to save. Blank lines are dropped; a
 * line with a name but no valid amount (or the other way round) is an error.
 */
export function fromItemDrafts(
  drafts: readonly ItemDraft[],
): { items: TransactionItem[]; error: null } | { items: null; error: string } {
  const items: TransactionItem[] = [];
  for (const draft of drafts) {
    const read = readDraft(draft);
    if (read === 'blank') continue;
    if (read === 'incomplete') return { items: null, error: es.items.incomplete };
    items.push(read);
  }
  return { items, error: null };
}

/**
 * What was bought, line by line. Optional, and it does not have to add up to
 * the total: receipts carry discounts and lines that are not products, so a
 * difference is shown, not refused.
 */
export function ItemsEditor({
  items,
  onChange,
  currency,
  totalCents,
  error,
  products,
  categories,
}: {
  items: readonly ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  currency: string;
  /** The transaction's amount in the same currency as the lines, to show the difference. */
  totalCents: number | null;
  error?: string;
  /** The products the user can pick (the ones already on a line are kept even if archived). */
  products: readonly Product[];
  /** The expense categories, in the order they are shown. */
  categories: readonly Category[];
}) {
  const update = (index: number, changes: Partial<ItemDraft>) =>
    onChange(items.map((item, position) => (position === index ? { ...item, ...changes } : item)));
  const pickProduct = (index: number, productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    const current = items[index]!;
    // A line with no label takes the name of its product; one with a label keeps what the ticket said.
    const unnamed = !current.product.trim() && !current.name.trim();
    update(index, {
      productId,
      categoryId: '',
      ...(product && unnamed ? { product: product.name, name: product.name } : {}),
    });
  };
  const rename = (index: number, value: string) => {
    const current = items[index]!;
    // A line typed by hand has no receipt text of its own: it follows the product.
    const typedByHand = current.name === '' || current.name === current.product;
    update(index, typedByHand ? { product: value, name: value } : { product: value });
  };

  const sum = sumCents(items.map((item) => parseAmountToCents(item.amount) ?? 0));
  const difference = totalCents === null ? 0 : totalCents - sum;
  const filled = items.filter(
    (item) => item.product.trim() || item.name.trim() || item.productId || item.categoryId,
  ).length;

  return (
    <div>
      <details className="rounded-2xl bg-surface shadow-card">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          {filled > 0 ? es.items.title(filled) : es.items.add}
        </summary>
        <div className="space-y-3 border-t border-line p-3">
          {items.map((item, index) => (
            <div key={index} className="space-y-2 border-b border-line pb-3 last:border-b-0">
              <div className="flex gap-2">
                <TextInput
                  aria-label={es.items.product}
                  placeholder={es.items.product}
                  maxLength={TEXT_LIMITS.product}
                  value={item.product || item.name}
                  onChange={(event) => rename(index, event.target.value)}
                />
                <Button
                  variant="quietDanger"
                  className="shrink-0 px-2"
                  aria-label={es.items.remove}
                  onClick={() => onChange(items.filter((_, position) => position !== index))}
                >
                  ✕
                </Button>
              </div>
              {item.name && item.product && item.name !== item.product ? (
                <p className="break-words text-sm text-muted">{es.items.onReceipt(item.name)}</p>
              ) : null}
              <div className="grid grid-cols-[1fr_4.5rem_7rem] gap-2">
                <Select
                  aria-label={es.items.listedProduct}
                  value={item.productId}
                  onChange={(event) => pickProduct(index, event.target.value)}
                >
                  <option value="">{es.items.noListedProduct}</option>
                  {products
                    .filter((product) => !product.archived || product.id === item.productId)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                </Select>
                <TextInput
                  aria-label={es.items.quantity}
                  placeholder={es.items.quantityShort}
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
                <TextInput
                  aria-label={es.items.amount}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="amount"
                  value={item.amount}
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
              </div>
              {item.productId ? null : (
                <Select
                  aria-label={es.items.category}
                  value={item.categoryId}
                  onChange={(event) => update(index, { categoryId: event.target.value })}
                >
                  <option value="">{es.items.sameCategory}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {optionLabel(category)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}

          {items.length < MAX_TRANSACTION_ITEMS ? (
            <Button variant="secondary" onClick={() => onChange([...items, EMPTY_ITEM])}>
              {es.items.addLine}
            </Button>
          ) : null}

          {filled > 0 ? (
            <p className="text-sm text-muted">
              {es.items.sum(formatMoney(sum, currency))}
              {difference !== 0 ? ` ${es.items.difference(formatMoney(difference, currency))}` : ''}
            </p>
          ) : null}
        </div>
      </details>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}
