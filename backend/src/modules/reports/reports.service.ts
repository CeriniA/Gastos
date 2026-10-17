import {
  PROJECTION_MONTHS,
  TOP_MERCHANTS,
  addMonthsToKey,
  convertBetween,
  firstDayOfMonth,
  lastDayOfMonth,
  monthKeyOf,
  nameKey,
  spendingCents,
  sumCents,
  type Account,
  type AccountActivity,
  type AccountReport,
  type Category,
  type CategoryAmount,
  type CategoryKind,
  type CategoryReport,
  type Consolidation,
  type Currency,
  type CurrencyCategoryReport,
  type CurrencyMerchants,
  type CurrencyTotals,
  type EvolutionReport,
  type ExchangeRate,
  type FiledAmount,
  type IsoDate,
  type KindReport,
  type MerchantReport,
  type MonthKey,
  type ProjectedCurrency,
  type ProjectedEntry,
  type ProjectionReport,
  type ReportRow,
} from '@gastos/shared';

/** What this module needs from the rest of the app. */
export interface ReportsDeps {
  listFiled: (month: string) => Promise<FiledAmount[]>;
  /** Live transactions paid in a range of days, the installments to come included. */
  listRows: (range: { from: IsoDate; to: IsoDate }) => Promise<ReportRow[]>;
  listCategories: () => Promise<Category[]>;
  listAccounts: () => Promise<Account[]>;
  /** The user's pesos-per-dollar rates, oldest first. */
  listRates: () => Promise<ExchangeRate[]>;
  /** What the fixed items still bring to a month. */
  expectedRecurrings: (month: MonthKey) => Promise<ProjectedEntry[]>;
  today: () => IsoDate;
}

const bySize = (a: { totalCents: number }, b: { totalCents: number }) => b.totalCents - a.totalCents;
const sum = (amounts: readonly { totalCents: number }[]) =>
  sumCents(amounts.map((amount) => amount.totalCents));

/**
 * Turns amounts into the currency a report is shown in. Without one, every
 * amount stays in its own. With one, each is converted with the rate valid on
 * its day (the latest that started on or before it); one that no rate covers
 * is left out and counted, never converted with a made-up rate.
 */
function converterFor(target: Currency | undefined, rates: readonly ExchangeRate[]) {
  const leftOut = new Set<string>();
  return {
    /** The amount as the report shows it, or null when it has to be left out. */
    show(
      cents: number,
      currency: Currency,
      date: IsoDate,
      id: string,
    ): { cents: number; currency: Currency } | null {
      if (!target || currency === target) return { cents, currency };
      const rate = rates.filter((candidate) => candidate.validFrom <= date).at(-1);
      if (!rate) {
        leftOut.add(id);
        return null;
      }
      return { cents: convertBetween(cents, currency, target, rate.arsPerUsd), currency: target };
    },
    consolidation(): Consolidation | null {
      return target ? { currency: target, leftOut: leftOut.size } : null;
    },
  };
}
type Converter = ReturnType<typeof converterFor>;

const currenciesOf = (items: readonly { currency: Currency }[]) =>
  [...new Set(items.map((item) => item.currency))].sort();

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
function categoryTotals(
  filed: readonly FiledAmount[],
  categories: readonly Category[],
): CurrencyCategoryReport[] {
  return currenciesOf(filed).map((currency) => {
    const of = (kind: CategoryKind) =>
      kindReport(
        kind,
        filed.filter((amount) => amount.currency === currency && amount.kind === kind),
        categories,
      );
    return { currency, income: of('income'), expense: of('expense') };
  });
}

/** Income and expenses per currency, counted like the monthly balance. */
function totalsOf(rows: readonly ReportRow[], convert: Converter): CurrencyTotals[] {
  const totals = new Map<Currency, CurrencyTotals>();
  for (const row of rows) {
    if (row.type === 'transfer') continue;
    const shown = convert.show(
      row.type === 'expense' ? spendingCents(row) : row.amountCents,
      row.currency,
      row.date,
      row.id,
    );
    if (!shown) continue;
    const entry = totals.get(shown.currency) ?? {
      currency: shown.currency,
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
    };
    if (row.type === 'income') entry.incomeCents += shown.cents;
    else entry.expenseCents += shown.cents;
    entry.balanceCents = entry.incomeCents - entry.expenseCents;
    totals.set(shown.currency, entry);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

const confirmed = (rows: readonly ReportRow[]) => rows.filter((row) => row.status === 'confirmed');
const inMonth = (rows: readonly ReportRow[], month: MonthKey) =>
  rows.filter((row) => monthKeyOf(row.paymentDate) === month);

export function createReportsService(deps: ReportsDeps) {
  async function setup(target: Currency | undefined) {
    return converterFor(target, target ? await deps.listRates() : []);
  }

  const monthRows = async (month: MonthKey) =>
    confirmed(await deps.listRows({ from: firstDayOfMonth(month), to: lastDayOfMonth(month) }));

  return {
    /** What came in and what went out in a month, by category, counted when it is paid. */
    async byCategory(month: MonthKey, target?: Currency): Promise<CategoryReport> {
      const [filed, categories, convert] = await Promise.all([
        deps.listFiled(month),
        deps.listCategories(),
        setup(target),
      ]);
      const shown = filed.flatMap((amount) => {
        const converted = convert.show(amount.cents, amount.currency, amount.date, amount.transactionId);
        return converted ? [{ ...amount, ...converted }] : [];
      });
      return { month, currencies: categoryTotals(shown, categories), consolidated: convert.consolidation() };
    },

    /**
     * What went in and out of each account in a month: its income, its
     * expenses, and the transfers that reached it or left it.
     */
    async byAccount(month: MonthKey, target?: Currency): Promise<AccountReport> {
      const [rows, accounts, convert] = await Promise.all([
        monthRows(month),
        deps.listAccounts(),
        setup(target),
      ]);
      const byId = new Map(accounts.map((account) => [account.id, account]));
      const activity = new Map<string, AccountActivity>();
      const add = (
        accountId: string,
        field: 'incomeCents' | 'expenseCents' | 'transfersInCents' | 'transfersOutCents',
        cents: number,
        row: ReportRow,
      ) => {
        const account = byId.get(accountId);
        if (!account) return;
        const shown = convert.show(cents, account.currency, row.date, row.id);
        if (!shown) return;
        const entry = activity.get(accountId) ?? {
          accountId,
          name: account.name,
          currency: shown.currency,
          incomeCents: 0,
          expenseCents: 0,
          transfersInCents: 0,
          transfersOutCents: 0,
        };
        entry[field] += shown.cents;
        activity.set(accountId, entry);
      };
      for (const row of rows) {
        if (row.type === 'income') add(row.accountId, 'incomeCents', row.amountCents, row);
        else if (row.type === 'expense') add(row.accountId, 'expenseCents', spendingCents(row), row);
        else {
          add(row.accountId, 'transfersOutCents', row.amountCents, row);
          if (row.toAccountId)
            add(row.toAccountId, 'transfersInCents', row.toAmountCents ?? row.amountCents, row);
        }
      }
      return {
        month,
        accounts: [...activity.values()].sort((a, b) => a.name.localeCompare(b.name)),
        consolidated: convert.consolidation(),
      };
    },

    /** Income and expenses month by month, ending in `to`, oldest first. */
    async evolution(to: MonthKey, months: number, target?: Currency): Promise<EvolutionReport> {
      const from = addMonthsToKey(to, 1 - months);
      const [rows, convert] = await Promise.all([
        deps.listRows({ from: firstDayOfMonth(from), to: lastDayOfMonth(to) }),
        setup(target),
      ]);
      const counted = confirmed(rows);
      return {
        months: Array.from({ length: months }, (_, index) => {
          const month = addMonthsToKey(from, index);
          return { month, totals: totalsOf(inMonth(counted, month), convert) };
        }),
        consolidated: convert.consolidation(),
      };
    },

    /**
     * Where the money of a month went: expenses grouped by their description,
     * whatever its case or accents, largest first. The rest, and what has no
     * description, go together.
     */
    async byMerchant(month: MonthKey, target?: Currency): Promise<MerchantReport> {
      const [rows, convert] = await Promise.all([monthRows(month), setup(target)]);
      const shown = rows
        .filter((row) => row.type === 'expense')
        .flatMap((row) => {
          const converted = convert.show(spendingCents(row), row.currency, row.date, row.id);
          return converted ? [{ row, ...converted }] : [];
        });
      const currencies: CurrencyMerchants[] = currenciesOf(shown).map((currency) => {
        const merchants = new Map<string, { name: string; totalCents: number; count: number }>();
        let totalCents = 0;
        for (const entry of shown.filter((candidate) => candidate.currency === currency)) {
          totalCents += entry.cents;
          const key = nameKey(entry.row.description);
          if (key === '') continue;
          const merchant = merchants.get(key) ?? {
            name: entry.row.description.trim(),
            totalCents: 0,
            count: 0,
          };
          merchant.totalCents += entry.cents;
          if (!entry.row.refund) merchant.count += 1;
          merchants.set(key, merchant);
        }
        const top = [...merchants.values()].sort(bySize).slice(0, TOP_MERCHANTS);
        return { currency, totalCents, merchants: top, othersCents: totalCents - sum(top) };
      });
      return { month, currencies, consolidated: convert.consolidation() };
    },

    /**
     * This month and the next ones: what is already certain (paid or to be
     * paid in each month, card purchases included) plus what is expected and
     * has not happened: installments to come and fixed items not seen yet.
     */
    async projection(target?: Currency): Promise<ProjectionReport> {
      const first = monthKeyOf(deps.today());
      const last = addMonthsToKey(first, PROJECTION_MONTHS - 1);
      const months = Array.from({ length: PROJECTION_MONTHS }, (_, index) => addMonthsToKey(first, index));
      const [rows, convert, recurring] = await Promise.all([
        deps.listRows({ from: firstDayOfMonth(first), to: lastDayOfMonth(last) }),
        setup(target),
        Promise.all(months.map((month) => deps.expectedRecurrings(month))),
      ]);

      return {
        months: months.map((month, index) => {
          const paid = inMonth(rows, month);
          const installments: ProjectedEntry[] = paid
            .filter((row) => row.status === 'projected' && row.type !== 'transfer')
            .map((row) => ({
              kind: 'installment',
              type: row.type === 'income' ? 'income' : 'expense',
              name: row.description,
              installment: row.installment
                ? { number: row.installment.number, total: row.installment.total }
                : null,
              date: row.paymentDate,
              cents: row.amountCents,
              currency: row.currency,
            }));
          const entries = [...installments, ...(recurring[index] ?? [])].flatMap((entry, position) => {
            const shown = convert.show(entry.cents, entry.currency, entry.date, `${month}:${position}`);
            return shown ? [{ ...entry, ...shown }] : [];
          });
          const certain = totalsOf(confirmed(paid), convert);
          const currencies: ProjectedCurrency[] = currenciesOf([...certain, ...entries]).map((currency) => {
            const sure = certain.find((totals) => totals.currency === currency);
            const expected = (type: CategoryKind) =>
              sumCents(
                entries
                  .filter((entry) => entry.currency === currency && entry.type === type)
                  .map((entry) => entry.cents),
              );
            const confirmedIncomeCents = sure?.incomeCents ?? 0;
            const confirmedExpenseCents = sure?.expenseCents ?? 0;
            const expectedIncomeCents = expected('income');
            const expectedExpenseCents = expected('expense');
            return {
              currency,
              confirmedIncomeCents,
              confirmedExpenseCents,
              expectedIncomeCents,
              expectedExpenseCents,
              balanceCents:
                confirmedIncomeCents + expectedIncomeCents - confirmedExpenseCents - expectedExpenseCents,
            };
          });
          return { month, currencies, entries: entries.sort((a, b) => a.date.localeCompare(b.date)) };
        }),
        consolidated: convert.consolidation(),
      };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
