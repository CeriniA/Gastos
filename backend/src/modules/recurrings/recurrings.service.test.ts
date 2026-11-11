import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Transaction, TransactionCreate } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

/** Fixed income and expenses: suggestions, marking, how each stands in a month. */

async function setup(today = '2026-10-10') {
  const app = createMemoryBackend(today);
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const services = await app.categories.create({ name: 'Servicios', kind: 'expense', parentId: null });
  const base: TransactionCreate = {
    type: 'expense',
    refund: false,
    date: '2026-10-05',
    amountCents: 10000,
    currency: 'ARS',
    accountId: bank.id,
    categoryId: services.id,
    description: 'Netflix',
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
  return { app, bank, services, add };
}

const suggested = async (app: Awaited<ReturnType<typeof setup>>['app']) =>
  (await app.recurrings.overview()).suggestions.map((suggestion) => [suggestion.name, suggestion.months]);

test('a merchant paid once a month for about the same amount, three months in a row, is suggested', async () => {
  const { app, add } = await setup();
  await add({ date: '2026-08-05', amountCents: 9500 });
  await add({ date: '2026-09-05', amountCents: 10000 });
  // This month's has not arrived yet: the run up to last month still counts.
  assert.deepEqual(await suggested(app), []);
  await add({ date: '2026-07-05', amountCents: 9000 });
  assert.deepEqual(await suggested(app), [['Netflix', 3]]);

  // The supermarket, several times a month, is not fixed; nor is a bill that jumped.
  for (const date of ['2026-08-02', '2026-08-20', '2026-09-03', '2026-09-25', '2026-10-01', '2026-10-08'])
    await add({ date, description: 'Coto', amountCents: 50000 });
  for (const [date, amountCents] of [
    ['2026-08-10', 3000],
    ['2026-09-10', 3000],
    ['2026-10-10', 9000],
  ] as const)
    await add({ date, description: 'Luz', amountCents });
  assert.deepEqual(await suggested(app), [['Netflix', 3]]);
});

test('marking makes a fixed item from the transaction; saying it is not fixed stops the suggestion', async () => {
  const { app, add } = await setup();
  const runs = ['2026-07-05', '2026-08-05', '2026-09-05'];
  const paid: Transaction[] = [];
  for (const date of runs) paid.push(await add({ date }));
  for (const date of runs) await add({ date, description: 'Gimnasio', amountCents: 20000 });

  const [first, second] = (await app.recurrings.overview()).suggestions;
  assert.deepEqual([first?.name, second?.name], ['Gimnasio', 'Netflix']);

  const fixed = await app.recurrings.fromTransaction({ transactionId: second!.transactionId, ignore: false });
  assert.deepEqual(
    [fixed.name, fixed.expectedAmountCents, fixed.dayOfMonth, fixed.active, fixed.merchantKey],
    ['Netflix', 10000, 5, true, 'netflix'],
  );
  assert.equal(
    app.store.transactions.find((transaction) => transaction.id === paid[2]!.id)?.recurringId,
    fixed.id,
  );

  await app.recurrings.fromTransaction({ transactionId: first!.transactionId, ignore: true });
  const overview = await app.recurrings.overview();
  assert.deepEqual(overview.suggestions, []);
  assert.deepEqual(
    overview.ignored.map((item) => item.name),
    ['Gimnasio'],
  );
  assert.deepEqual(
    overview.items.map((item) => item.recurring.name),
    ['Netflix'],
  );

  // Marking another month of the same merchant joins the item that exists.
  const again = await app.recurrings.fromTransaction({ transactionId: paid[0]!.id, ignore: false });
  assert.equal(again.id, fixed.id);
});

test('each month a fixed item arrived, changed a lot, is late or is still to come', async () => {
  const { app, add } = await setup('2026-10-20');
  const september = await add({ date: '2026-09-05' });
  const netflix = await app.recurrings.fromTransaction({ transactionId: september.id, ignore: false });
  const state = async (month?: string) => (await app.recurrings.overview(month)).items[0]?.state;

  // The 5th plus five days of grace went by in October and nothing came.
  assert.equal(await state(), 'late');
  assert.equal(await state('2026-09'), 'seen');
  // A different description, marked by hand, also counts.
  const october = await add({ date: '2026-10-15', description: 'NETFLIX.COM', amountCents: 15000 });
  await app.transactions.markRecurring(october.id, netflix.id);
  assert.equal(await state(), 'changed');
  assert.equal((await app.recurrings.overview()).items[0]?.seenCents, 15000);

  await app.recurrings.update(netflix.id, { expectedAmountCents: 15000, dayOfMonth: 25 });
  assert.equal(await state(), 'seen');
  assert.equal(await state('2026-11'), 'expected');
  await app.recurrings.update(netflix.id, { active: false });
  assert.equal(await state(), 'paused');
});

test('only an income or expense with a description is fixed, and deleting one keeps its transactions', async () => {
  const { app, bank, add } = await setup();
  const cash = await app.accounts.create({ name: 'Efectivo', type: 'cash', currency: 'ARS' });
  const transfer = await add({ type: 'transfer', categoryId: null, toAccountId: cash.id });
  const blank = await add({ description: '' });
  assert.equal(
    await codeOf(app.recurrings.fromTransaction({ transactionId: transfer.id, ignore: false })),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.recurrings.fromTransaction({ transactionId: blank.id, ignore: false })),
    'VALIDATION',
  );

  const paid = await add({});
  const fixed = await app.recurrings.fromTransaction({ transactionId: paid.id, ignore: false });
  // An account with nothing but a fixed item is still in use.
  const savings = await app.accounts.create({ name: 'Ahorro', type: 'bank', currency: 'USD' });
  const moved = await app.recurrings.update(fixed.id, { accountId: savings.id });
  assert.equal(moved.currency, 'USD', 'a fixed item is in its account currency');
  assert.equal(await codeOf(app.accounts.remove(savings.id)), 'IN_USE');
  await app.recurrings.update(fixed.id, { accountId: bank.id });
  // A deleted category leaves the item without one.
  const other = await app.categories.create({ name: 'Otros', kind: 'expense', parentId: null });
  await app.recurrings.update(fixed.id, { categoryId: other.id });
  await app.categories.remove(other.id);
  assert.equal((await app.recurrings.overview()).items[0]?.recurring.categoryId, null);
  assert.equal(await codeOf(app.recurrings.update(fixed.id, { categoryId: 'f'.repeat(24) })), 'VALIDATION');

  await app.recurrings.remove(fixed.id);
  assert.deepEqual((await app.recurrings.overview()).items, []);
  const kept = app.store.transactions.find((transaction) => transaction.id === paid.id);
  assert.deepEqual([kept?.deletedAt, kept?.recurringId], [null, null]);
});

test('the same name is two fixed items in two currencies, but one in the same currency', async () => {
  const { app, bank, add } = await setup();
  const dollars = await app.accounts.create({ name: 'Caja USD', type: 'cash', currency: 'USD' });
  const pesos = await app.recurrings.fromTransaction({ transactionId: (await add({})).id, ignore: false });
  const usd = await app.recurrings.fromTransaction({
    transactionId: (await add({ accountId: dollars.id, currency: 'USD', categoryId: null })).id,
    ignore: false,
  });
  assert.deepEqual(
    [pesos.name, pesos.currency, usd.name, usd.currency],
    ['Netflix', 'ARS', 'Netflix', 'USD'],
  );
  assert.notEqual(pesos.id, usd.id);

  // Moving the dollar one to a peso account would make two "Netflix" in pesos.
  assert.equal(await codeOf(app.recurrings.update(usd.id, { accountId: bank.id })), 'DUPLICATE');
  // Its own name, written another way, is still its own.
  assert.equal((await app.recurrings.update(usd.id, { name: 'NETFLIX' })).name, 'NETFLIX');
});
