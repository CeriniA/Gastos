import type {
  Category,
  CategoryAmount,
  CategoryKind,
  CategoryReport,
  CurrencyCategoryReport,
  FiledAmount,
  KindReport,
  MonthKey,
} from '@gastos/shared';

/** What this module needs from the rest of the app. */
export interface ReportsDeps {
  listFiled: (month: string) => Promise<FiledAmount[]>;
  listCategories: () => Promise<Category[]>;
}

const bySize = (a: { totalCents: number }, b: { totalCents: number }) => b.totalCents - a.totalCents;
const sum = (amounts: readonly { totalCents: number }[]) =>
  amounts.reduce((total, amount) => total + amount.totalCents, 0);

/**
 * One kind (income or expenses) of one currency as a tree: each category
 * carries what is filed under it and under its subcategories. Categories with
 * nothing in the month are left out.
 */
function kindReport(
  kind: CategoryKind,
  filed: readonly FiledAmount[],
  categories: readonly Category[],
): KindReport {
  const own = new Map<string | null, number>();
  for (const amount of filed) {
    own.set(amount.categoryId, (own.get(amount.categoryId) ?? 0) + amount.cents);
  }

  const branch = (category: Category): CategoryAmount | null => {
    const children = categories
      .filter((candidate) => candidate.parentId === category.id)
      .flatMap((child) => branch(child) ?? [])
      .sort(bySize);
    if (!own.has(category.id) && children.length === 0) return null;
    return {
      categoryId: category.id,
      name: category.name,
      totalCents: (own.get(category.id) ?? 0) + sum(children),
      children,
    };
  };

  const roots = categories
    .filter((category) => category.kind === kind && category.parentId === null)
    .flatMap((root) => branch(root) ?? []);
  // What has no category, and what points at one that is gone, is told apart from the rest.
  const known = new Set(categories.map((category) => category.id));
  const unfiled = [...own]
    .filter(([categoryId]) => categoryId === null || !known.has(categoryId))
    .reduce((total, [, cents]) => total + cents, 0);
  const nodes =
    unfiled === 0 ? roots : [...roots, { categoryId: null, name: '', totalCents: unfiled, children: [] }];
  return { kind, totalCents: sum(nodes), categories: nodes.sort(bySize) };
}

/** Groups what was filed in a month by currency, then by kind, then by category. */
export function categoryTotals(
  filed: readonly FiledAmount[],
  categories: readonly Category[],
): CurrencyCategoryReport[] {
  const currencies = [...new Set(filed.map((amount) => amount.currency))].sort();
  return currencies.map((currency) => {
    const of = (kind: CategoryKind) =>
      kindReport(
        kind,
        filed.filter((amount) => amount.currency === currency && amount.kind === kind),
        categories,
      );
    return { currency, income: of('income'), expense: of('expense') };
  });
}

export function createReportsService(deps: ReportsDeps) {
  return {
    /** What came in and what went out in a month, by category, counted when it is paid. */
    async byCategory(month: MonthKey): Promise<CategoryReport> {
      const [filed, categories] = await Promise.all([deps.listFiled(month), deps.listCategories()]);
      return { month, currencies: categoryTotals(filed, categories) };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
