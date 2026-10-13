import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CategoryAmount, TransactionCreate } from '@gastos/shared';
import { createMemoryBackend } from '../../testing/memory';

/** The report by category, over the in-memory backend. */

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
    note: '',
    tagIds: [],
    splits: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    items: [],
  };
  const add = (changes: Partial<TransactionCreate>) => app.transactions.create({ ...base, ...changes });
  return { app, bank, cash, home, services, power, food, salary, add };
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
  // Divided: each part goes to its own category.
  await add({
    amountCents: 700,
    splits: [
      { categoryId: power.id, amountCents: 200 },
      { categoryId: food.id, amountCents: 500 },
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
