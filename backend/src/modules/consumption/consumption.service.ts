import {
  firstDayOfMonth,
  lastDayOfMonth,
  nameKey,
  type ConsumptionItem,
  type ConsumptionSummary,
  type CurrencyConsumption,
  type GroupConsumption,
  type MonthKey,
  type ProductConsumption,
  type ProductGroup,
} from '@gastos/shared';

/** What this module needs from the rest of the app. */
export interface ConsumptionDeps {
  listItems: (range: { from?: string; to?: string }) => Promise<ConsumptionItem[]>;
}

/** How many lines a search answers at most. */
const SEARCH_LIMIT = 200;

/** The name a line is reported under: the generic product, or the ticket text when there is none. */
function productOf(item: ConsumptionItem): string {
  return item.product.trim() || item.name.trim();
}

const bySize = (a: { totalCents: number }, b: { totalCents: number }) => b.totalCents - a.totalCents;

function addToProduct(products: Map<string, ProductConsumption>, item: ConsumptionItem): void {
  const product = productOf(item);
  const key = nameKey(product);
  const current = products.get(key);
  if (!current) {
    products.set(key, { product, totalCents: item.amountCents, purchases: 1, quantity: item.quantity });
    return;
  }
  current.totalCents += item.amountCents;
  current.purchases += 1;
  // A total quantity only means something when every line stated one.
  current.quantity =
    current.quantity === null || item.quantity === null
      ? null
      : Math.round((current.quantity + item.quantity) * 1000) / 1000;
}

/**
 * Groups receipt lines by currency, then by product group, then by product.
 * Amounts in different currencies are never added together.
 */
export function summarizeItems(items: ConsumptionItem[]): CurrencyConsumption[] {
  const currencies = new Map<string, Map<ProductGroup | null, Map<string, ProductConsumption>>>();
  for (const item of items) {
    const groups = currencies.get(item.currency) ?? new Map();
    currencies.set(item.currency, groups);
    const products = groups.get(item.group) ?? new Map();
    groups.set(item.group, products);
    addToProduct(products, item);
  }

  return [...currencies].map(([currency, groupMap]) => {
    const groups: GroupConsumption[] = [...groupMap]
      .map(([group, productMap]) => {
        const products = [...productMap.values()].sort(bySize);
        return {
          group,
          totalCents: products.reduce((sum, product) => sum + product.totalCents, 0),
          products,
        };
      })
      .sort(bySize);
    return { currency, totalCents: groups.reduce((sum, group) => sum + group.totalCents, 0), groups };
  });
}

export function createConsumptionService(deps: ConsumptionDeps) {
  return {
    /** What was bought in a month, by group and product. */
    async summary(month: MonthKey): Promise<ConsumptionSummary> {
      const items = await deps.listItems({ from: firstDayOfMonth(month), to: lastDayOfMonth(month) });
      return { month, currencies: summarizeItems(items) };
    },

    /** Receipt lines whose product or ticket text contains the words searched, newest first. */
    async search(query: { q: string; from?: string; to?: string }): Promise<ConsumptionItem[]> {
      const words = nameKey(query.q).split(' ');
      const items = await deps.listItems({ from: query.from, to: query.to });
      return items
        .filter((item) => {
          const text = nameKey(`${item.product} ${item.name}`);
          return words.every((word) => text.includes(word));
        })
        .slice(0, SEARCH_LIMIT);
    },
  };
}

export type ConsumptionService = ReturnType<typeof createConsumptionService>;
