import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CategoryAmount, TransactionCreate } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

/** The reports, over the in-memory backend. */

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const cash = await app.accounts.create({ name: 'Caja USD', type: 'cash', currency: 'USD' });
  const category = (name: string, kind: 'income' | 'expense', parentId: string | null = null) =>
    app.categories.create({ name, kind, parentId });
  const home = await category('Vivienda', 'expense');
  const services = await category('Servicios', 'expense', home.id);
  const power = await category('Luz', 'expense', services.id);
  const food = await category('Comida', 'expense');
  await category('Ocio', 'expense'); // nothing this month
  const salary = await category('Sueldo', 'income');

  const base: TransactionCreate = {
    type: 'expense',
    refund: false,
    date: '2026-10-05',
    amountCents: 0,
    currency: 'ARS',
    accountId: bank.id,
    categoryId: null,
    description: '',
    merchantId: null,
    note: '',
    tagIds: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    items: [],
  };
  const add = (changes: Partial<TransactionCreate>) => app.transactions.create({ ...base, ...changes });
  return { app, bank, cash, home, services, power, food, salary, base, add };
}

/** A tree as nested [name, total, children] triples, to compare at a glance. */
type Shape = [string, number, Shape[]];
const shape = (amounts: readonly CategoryAmount[]): Shape[] =>
  amounts.map((amount) => [amount.name, amount.totalCents, shape(amount.children)]);

test('a month is added up by category, each one with its subcategories, largest first', async () => {
  const { app, home, power, food, salary, add } = await setup();
  await add({ amountCents: 1000, categoryId: power.id });
  await add({ amountCents: 300, categoryId: home.id });
  await add({ amountCents: 5000, categoryId: food.id });
  await add({ amountCents: 50, categoryId: null });
  // With lines: each goes to its own category, and the rest stays in the category of the whole.
  await add({
    amountCents: 700,
    categoryId: food.id,
    items: [
      { name: 'Luz', amountCents: 200, product: '', group: null, quantity: null, productId: null, categoryId: power.id },
    ],
  });
  // A refund takes away from its category.
  await add({ amountCents: 1500, categoryId: food.id, refund: true });
  await add({ type: 'income', amountCents: 90000, categoryId: salary.id });

  const [pesos, ...others] = (await app.reports.byCategory('2026-10')).currencies;
  assert.deepEqual(others, []);
  assert.equal(pesos?.currency, 'ARS');
  assert.equal(pesos?.expense.totalCents, 5550);
  assert.deepEqual(shape(pesos!.expense.categories), [
    ['Comida', 4000, []],
    ['Vivienda', 1500, [['Servicios', 1200, [['Luz', 1200, []]]]]],
    ['', 50, []],
  ]);
  assert.deepEqual(shape(pesos!.income.categories), [['Sueldo', 90000, []]]);
  assert.equal(pesos?.income.totalCents, 90000);

  // The same figures the monthly balance shows.
  const [balance] = (await app.transactions.summary('2026-10')).totals;
  assert.deepEqual([balance?.expenseCents, balance?.incomeCents], [5550, 90000]);
});

test('transfers, the trash and other months are left out; currencies are never added together', async () => {
  const { app, bank, cash, food, add } = await setup();
  await add({ amountCents: 1000, categoryId: food.id });
  await add({ amountCents: 2500, categoryId: food.id, currency: 'USD', accountId: cash.id });
  await add({ amountCents: 400, categoryId: food.id, date: '2026-09-30' });
  await add({
    type: 'transfer',
    amountCents: 9000,
    toAccountId: cash.id,
    toAmountCents: 10,
    accountId: bank.id,
  });
  const trashed = await add({ amountCents: 777, categoryId: food.id });
  await app.transactions.remove(trashed.id);

  const report = await app.reports.byCategory('2026-10');
  assert.deepEqual(
    report.currencies.map((entry) => [entry.currency, entry.expense.totalCents, entry.income.totalCents]),
    [
      ['ARS', 1000, 0],
      ['USD', 2500, 0],
    ],
  );
  assert.deepEqual((await app.reports.byCategory('2026-08')).currencies, []);
});

test('by account: each account with its income, expenses and the transfers in and out', async () => {
  const { app, cash, food, salary, add } = await setup();
  const wallet = await app.accounts.create({ name: 'Billetera', type: 'wallet', currency: 'ARS' });
  await add({ type: 'income', amountCents: 90000, categoryId: salary.id });
  await add({ amountCents: 1000, categoryId: food.id });
  await add({ amountCents: 300, categoryId: food.id, refund: true });
  await add({ type: 'transfer', amountCents: 5000, toAccountId: wallet.id });
  await add({ type: 'transfer', amountCents: 20000, toAccountId: cash.id, toAmountCents: 15 });
  await add({ amountCents: 999, categoryId: food.id, date: '2026-09-30' });

  const report = await app.reports.byAccount('2026-10');
  assert.deepEqual(
    report.accounts.map((entry) => [
      entry.name,
      entry.currency,
      entry.incomeCents,
      entry.expenseCents,
      entry.transfersInCents,
      entry.transfersOutCents,
      entry.closingBalanceCents,
    ]),
    [
      // Its balance also counts the expense of September: a balance is everything up to the day.
      ['Banco', 'ARS', 90000, 700, 0, 25000, 63301],
      ['Billetera', 'ARS', 0, 0, 5000, 0, 5000],
      ['Caja USD', 'USD', 0, 0, 15, 0, 15],
    ],
  );
  assert.equal(report.balanceOn, '2026-10-10', 'this month: today');
  assert.equal(report.consolidated, null);
});

test('by account: every account in use is listed with its balance, even without movements', async () => {
  const { app, bank, food, add } = await setup();
  const wallet = await app.accounts.create({
    name: 'MercadoPago',
    type: 'wallet',
    currency: 'ARS',
    openingBalance: { amountCents: 85000, date: '2026-10-01' },
  });
  const old = await app.accounts.create({ name: 'Vieja', type: 'cash', currency: 'ARS' });
  await app.accounts.update(old.id, { archived: true });
  await add({ amountCents: 1000, categoryId: food.id, date: '2026-09-20' });

  const october = await app.reports.byAccount('2026-10');
  assert.deepEqual(
    october.accounts.map((entry) => [entry.name, entry.expenseCents, entry.closingBalanceCents]),
    [
      ['Banco', 0, -1000],
      ['Caja USD', 0, 0],
      ['MercadoPago', 0, 85000],
    ],
    'an archived account without movements is left out',
  );

  // At the end of September: the bank had spent; MercadoPago's opening balance is from October, unknown before.
  const september = await app.reports.byAccount('2026-09');
  assert.equal(september.balanceOn, '2026-09-30');
  assert.deepEqual(
    september.accounts
      .filter((entry) => [bank.id, wallet.id].includes(entry.accountId))
      .map((entry) => [entry.name, entry.expenseCents, entry.closingBalanceCents]),
    [
      ['Banco', 1000, -1000],
      ['MercadoPago', 0, null],
    ],
  );
});

test('month by month: income and expenses of each month, the empty ones too', async () => {
  const { app, food, salary, add } = await setup();
  await add({ type: 'income', amountCents: 90000, categoryId: salary.id, date: '2026-08-01' });
  await add({ amountCents: 1000, categoryId: food.id, date: '2026-08-20' });
  await add({ amountCents: 4000, categoryId: food.id, date: '2026-10-02' });

  const { months } = await app.reports.evolution('2026-10', 3);
  assert.deepEqual(
    months.map((entry) => [
      entry.month,
      entry.totals.map((totals) => [totals.incomeCents, totals.expenseCents]),
    ]),
    [
      ['2026-08', [[90000, 1000]]],
      ['2026-09', []],
      ['2026-10', [[0, 4000]]],
    ],
  );
});

test('by merchant: the same description is one merchant, whatever its case or accents', async () => {
  const { app, food, add } = await setup();
  await add({ amountCents: 1000, categoryId: food.id, description: 'Café Martínez' });
  await add({ amountCents: 2000, categoryId: food.id, description: 'cafe martinez ' });
  await add({ amountCents: 500, categoryId: food.id, description: 'Café Martínez', refund: true });
  await add({ amountCents: 7000, categoryId: food.id, description: 'Coto' });
  await add({ amountCents: 300, categoryId: food.id, description: '' });

  const [pesos] = (await app.reports.byMerchant('2026-10')).currencies;
  assert.equal(pesos?.totalCents, 9800);
  assert.deepEqual(
    pesos?.merchants.map((merchant) => [merchant.name, merchant.totalCents, merchant.count]),
    [
      ['Coto', 7000, 1],
      ['Café Martínez', 2500, 2],
    ],
  );
  assert.equal(pesos?.othersCents, 300);
});

test('in one currency: each transaction is converted with the rate of its day, and none is invented', async () => {
  const { app, cash, food, add } = await setup();
  const dollars = { currency: 'USD' as const, accountId: cash.id, categoryId: food.id };
  await add({ amountCents: 100000, categoryId: food.id, date: '2026-10-01' });
  await add({ ...dollars, amountCents: 1000, date: '2026-10-02' });
  await add({ ...dollars, amountCents: 2000, date: '2026-10-08' });

  // No rate yet: the dollars are left out and counted, the pesos stay.
  const without = await app.reports.byCategory('2026-10', 'ARS');
  assert.deepEqual(without.consolidated, { currency: 'ARS', leftOut: 2 });
  assert.deepEqual(
    without.currencies.map((entry) => [entry.currency, entry.expense.totalCents]),
    [['ARS', 100000]],
  );

  // A rate applies from its day on; a later one changes only what comes after it.
  await app.exchangeRates.create({ validFrom: '2026-10-01', arsPerUsd: 1000 });
  await app.exchangeRates.create({ validFrom: '2026-10-05', arsPerUsd: 1500 });
  const pesos = await app.reports.byCategory('2026-10', 'ARS');
  assert.deepEqual(pesos.consolidated, { currency: 'ARS', leftOut: 0 });
  assert.equal(pesos.currencies[0]?.expense.totalCents, 100000 + 1000000 + 3000000);

  const inDollars = await app.reports.evolution('2026-10', 1, 'USD');
  assert.deepEqual(
    inDollars.months[0]?.totals.map((totals) => [totals.currency, totals.expenseCents]),
    [['USD', 100 + 1000 + 2000]],
  );
  // Two rates cannot start on the same day.
  assert.equal(
    await codeOf(app.exchangeRates.create({ validFrom: '2026-10-05', arsPerUsd: 9 })),
    'DUPLICATE',
  );
});

test('the projection adds installments to come and fixed items not seen yet to what is certain', async () => {
  const { app, food, salary, base, add } = await setup();
  const visa = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  await app.installmentPlans.create({
    transaction: {
      ...base,
      accountId: visa.id,
      amountCents: 30000,
      date: '2026-09-20',
      description: 'Silla',
    },
    installments: 3,
  });
  const salaryPaid = await add({
    type: 'income',
    amountCents: 90000,
    categoryId: salary.id,
    description: 'Sueldo',
    date: '2026-09-01',
  });
  await app.recurrings.fromTransaction({ transactionId: salaryPaid.id, ignore: false });
  await add({ amountCents: 5000, categoryId: food.id, date: '2026-10-03' });

  const { months } = await app.reports.projection();
  assert.deepEqual(
    months.map((month) => month.month),
    ['2026-10', '2026-11', '2026-12'],
  );
  const [october, november] = months;
  assert.deepEqual(
    october?.entries.map((entry) => [entry.kind, entry.name, entry.cents, entry.date]),
    [
      ['recurring', 'Sueldo', 90000, '2026-10-01'],
      ['installment', 'Silla', 10000, '2026-10-20'],
    ],
  );
  assert.deepEqual(october?.currencies, [
    {
      currency: 'ARS',
      confirmedIncomeCents: 0,
      confirmedExpenseCents: 5000,
      expectedIncomeCents: 90000,
      expectedExpenseCents: 10000,
      balanceCents: 75000,
    },
  ]);
  assert.equal(november?.entries.length, 2);

  // Once the salary arrives it is certain, no longer expected.
  await add({
    type: 'income',
    amountCents: 91000,
    categoryId: salary.id,
    description: 'SUELDO',
    date: '2026-10-02',
  });
  const [again] = (await app.reports.projection()).months;
  assert.deepEqual(
    again?.entries.map((entry) => entry.kind),
    ['installment'],
  );
  assert.equal(again?.currencies[0]?.confirmedIncomeCents, 91000);
});
