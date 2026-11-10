import {
  MAX_ALIASES_PER_ITEM,
  PRODUCT_GROUPS,
  TEXT_LIMITS,
  nameKey,
  type ProductGroup,
} from '@gastos/shared';

/**
 * Builds the merchant and product lists out of what the user already typed:
 * the descriptions of their expenses, the products of their receipts and the
 * things the app was taught ("this merchant goes to this category", "this
 * printed line is this product"). Pure, so it can be tested without a database;
 * the migration that uses it only reads and writes.
 */

export interface LegacyTransaction {
  description: string;
  categoryId: string | null;
  items: readonly { name: string; product?: string; group?: string | null }[];
}

export interface LegacyInput {
  /** Expenses that are not in the trash. */
  transactions: readonly LegacyTransaction[];
  categoryRules: readonly { merchant: string; categoryId: string }[];
  productRules: readonly { name: string; product: string; group: ProductGroup | null }[];
  /** Ids of the expense categories that exist. */
  expenseCategoryIds: ReadonlySet<string>;
  /** The category each product group was turned into. */
  groupCategories: Readonly<Partial<Record<ProductGroup, string>>>;
}

export interface PlannedMerchant {
  name: string;
  defaultCategoryId: string | null;
}

export interface PlannedProduct {
  name: string;
  categoryId: string;
  aliases: string[];
}

export interface ListsPlan {
  merchants: PlannedMerchant[];
  products: PlannedProduct[];
  /** Products left out because nothing says which category they belong to. */
  productsWithoutCategory: number;
}

const fitName = (text: string) => text.trim().slice(0, TEXT_LIMITS.name);
const fitPrinted = (text: string) => text.trim().slice(0, TEXT_LIMITS.description);

const isGroup = (value: string | null | undefined): value is ProductGroup =>
  (PRODUCT_GROUPS as readonly string[]).includes(value ?? '');

/** Counts how often each spelling of a name was written; the most common one is the name. */
class Spellings {
  private spellings = new Map<string, Map<string, number>>();

  add(text: string): string {
    const key = nameKey(text);
    const counts = this.spellings.get(key) ?? new Map<string, number>();
    counts.set(text, (counts.get(text) ?? 0) + 1);
    this.spellings.set(key, counts);
    return key;
  }

  best(key: string): string {
    return mostVoted(this.spellings.get(key) ?? new Map<string, number>()) ?? key;
  }

  keys(): string[] {
    return [...this.spellings.keys()].filter((key) => key !== '');
  }
}

/** The candidate with most votes; the first one to get them wins a tie. */
function mostVoted<T>(votes: ReadonlyMap<T, number>): T | undefined {
  let winner: T | undefined;
  let top = 0;
  for (const [candidate, count] of votes) {
    if (count > top) {
      winner = candidate;
      top = count;
    }
  }
  return winner;
}

function vote<T>(votes: Map<T, number>, candidate: T): void {
  votes.set(candidate, (votes.get(candidate) ?? 0) + 1);
}

/** The product groups the user's data uses: only those become categories. */
export function groupsInUse(input: Pick<LegacyInput, 'transactions' | 'productRules'>): ProductGroup[] {
  const used = new Set<ProductGroup>();
  for (const transaction of input.transactions) {
    for (const item of transaction.items) {
      if (item.product?.trim() && isGroup(item.group)) used.add(item.group);
    }
  }
  for (const rule of input.productRules) if (rule.product.trim() && rule.group) used.add(rule.group);
  return [...used];
}

function planMerchants(input: LegacyInput): PlannedMerchant[] {
  const spellings = new Spellings();
  for (const transaction of input.transactions) {
    if (transaction.description.trim()) spellings.add(fitName(transaction.description));
  }
  const usualCategory = new Map<string, string>();
  for (const rule of input.categoryRules) {
    const key = spellings.add(fitName(rule.merchant));
    if (input.expenseCategoryIds.has(rule.categoryId)) usualCategory.set(key, rule.categoryId);
  }
  return spellings
    .keys()
    .map((key) => ({ name: spellings.best(key), defaultCategoryId: usualCategory.get(key) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** What the data says about one product, before it becomes a list entry. */
interface ProductEvidence {
  groups: Map<ProductGroup, number>;
  categories: Map<string, number>;
  printed: Map<string, string>;
}

/** Reads every product the data mentions, with what it says about each one. */
function collectEvidence(input: LegacyInput): { spellings: Spellings; evidence: Map<string, ProductEvidence> } {
  const spellings = new Spellings();
  const evidence = new Map<string, ProductEvidence>();
  const evidenceOf = (product: string): ProductEvidence => {
    const key = spellings.add(fitName(product));
    let found = evidence.get(key);
    if (!found) {
      found = { groups: new Map(), categories: new Map(), printed: new Map() };
      evidence.set(key, found);
    }
    return found;
  };
  const addPrinted = (found: ProductEvidence, text: string) => {
    const printed = fitPrinted(text);
    if (nameKey(printed) !== '') found.printed.set(nameKey(printed), printed);
  };

  for (const transaction of input.transactions) {
    const usual = transaction.categoryId && input.expenseCategoryIds.has(transaction.categoryId);
    for (const item of transaction.items) {
      if (!item.product?.trim()) continue;
      const found = evidenceOf(item.product);
      if (isGroup(item.group)) vote(found.groups, item.group);
      if (usual) vote(found.categories, transaction.categoryId!);
      addPrinted(found, item.name);
    }
  }
  for (const rule of input.productRules) {
    if (!rule.product.trim()) continue;
    const found = evidenceOf(rule.product);
    if (rule.group) vote(found.groups, rule.group);
    addPrinted(found, rule.name);
  }
  return { spellings, evidence };
}

function planProducts(input: LegacyInput): Pick<ListsPlan, 'products' | 'productsWithoutCategory'> {
  const { spellings, evidence } = collectEvidence(input);
  const keys = spellings.keys().sort((a, b) => spellings.best(a).localeCompare(spellings.best(b)));
  // Names come first: a printed text that is another product's name stays with that product.
  const taken = new Set(keys);
  const products: PlannedProduct[] = [];
  let productsWithoutCategory = 0;
  for (const key of keys) {
    const found = evidence.get(key)!;
    const group = mostVoted(found.groups);
    const categoryId = (group && input.groupCategories[group]) ?? mostVoted(found.categories);
    if (!categoryId) {
      productsWithoutCategory += 1;
      continue;
    }
    const aliases: string[] = [];
    for (const [printedKey, printed] of found.printed) {
      if (taken.has(printedKey) || aliases.length >= MAX_ALIASES_PER_ITEM) continue;
      taken.add(printedKey);
      aliases.push(printed);
    }
    products.push({ name: spellings.best(key), categoryId, aliases });
  }
  return { products, productsWithoutCategory };
}

export function planLists(input: LegacyInput): ListsPlan {
  return { merchants: planMerchants(input), ...planProducts(input) };
}
