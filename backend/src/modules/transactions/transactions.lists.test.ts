import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionCreate, TransactionItem } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

async function setup() {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });
  const pharmacy = await app.categories.create({ name: 'Farmacia', kind: 'expense', parentId: null });
  const salary = await app.categories.create({ name: 'Sueldo', kind: 'income', parentId: null });
  const coto = await app.merchants.create({ name: 'Coto', defaultCategoryId: food.id, aliases: [] });
  const yerba = await app.products.create({ name: 'Yerba', categoryId: food.id, aliases: [] });
  const expense: TransactionCreate = {
    type: 'expense',
    refund: false,
    date: '2026-10-05',
    amountCents: 100000,
    currency: 'ARS',
    accountId: bank.id,
    categoryId: food.id,
    merchantId: null,
    description: '',
    note: '',
    tagIds: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    items: [],
  };
  const line = (overrides: Partial<TransactionItem>): TransactionItem => ({
    name: 'YERB.PLAY',
    amountCents: 5000,
    product: '',
    group: null,
    quantity: null,
    productId: null,
    categoryId: null,
    ...overrides,
  });
  return { app, bank, food, pharmacy, salary, coto, yerba, expense, line };
}

test('an expense keeps the merchant it was paid at', async () => {
  const { app, coto, expense } = await setup();
  const created = await app.transactions.create({ ...expense, merchantId: coto.id });
  assert.equal(created.merchantId, coto.id);
  const cleared = await app.transactions.update(created.id, { merchantId: null });
  assert.equal(cleared.merchantId, null);
});

test('the merchant must exist, and only an expense has one', async () => {
  const { app, bank, salary, coto, expense } = await setup();
  assert.equal(
    await codeOf(app.transactions.create({ ...expense, merchantId: 'a'.repeat(24) })),
    'VALIDATION',
  );
  const income = { ...expense, type: 'income' as const, categoryId: salary.id, merchantId: coto.id };
  assert.equal(await codeOf(app.transactions.create(income)), 'VALIDATION');
  const other = await app.accounts.create({ name: 'Efectivo', type: 'cash', currency: 'ARS' });
  const transfer = {
    ...expense,
    type: 'transfer' as const,
    categoryId: null,
    accountId: bank.id,
    toAccountId: other.id,
    merchantId: coto.id,
  };
  assert.equal(await codeOf(app.transactions.create(transfer)), 'VALIDATION');
});

test('an archived merchant is not offered again, but stays on what already had it', async () => {
  const { app, coto, expense } = await setup();
  const created = await app.transactions.create({ ...expense, merchantId: coto.id });
  await app.merchants.update(coto.id, { archived: true });
  assert.equal(await codeOf(app.transactions.create({ ...expense, merchantId: coto.id })), 'VALIDATION');
  assert.equal((await app.transactions.update(created.id, { note: 'x' })).merchantId, coto.id);
});

test('a line can be a product of the list, or have its own category when it has no product', async () => {
  const { app, pharmacy, yerba, expense, line } = await setup();
  const created = await app.transactions.create({
    ...expense,
    items: [line({ productId: yerba.id }), line({ name: 'Aspirina', categoryId: pharmacy.id })],
  });
  assert.equal(created.items[0]?.productId, yerba.id);
  assert.equal(created.items[1]?.categoryId, pharmacy.id);
});

test('a line needs an existing product, and a line with a product takes the category of the product', async () => {
  const { app, pharmacy, yerba, salary, expense, line } = await setup();
  const create = (item: TransactionItem) => codeOf(app.transactions.create({ ...expense, items: [item] }));
  assert.equal(await create(line({ productId: 'a'.repeat(24) })), 'VALIDATION');
  assert.equal(await create(line({ productId: yerba.id, categoryId: pharmacy.id })), 'VALIDATION');
  assert.equal(await create(line({ categoryId: salary.id })), 'VALIDATION');
});

test('merging a category moves the categories of the lines too, and a category used by a line is not deleted', async () => {
  const { app, food, pharmacy, expense, line } = await setup();
  const created = await app.transactions.create({
    ...expense,
    categoryId: food.id,
    items: [line({ name: 'Aspirina', categoryId: pharmacy.id })],
  });
  assert.equal(await codeOf(app.categories.remove(pharmacy.id)), 'IN_USE');
  const target = await app.categories.create({ name: 'Salud', kind: 'expense', parentId: null });
  await app.categories.merge(pharmacy.id, target.id);
  assert.equal((await app.transactions.get(created.id)).items[0]?.categoryId, target.id);
});

test('a merchant nobody paid at can be deleted; one in use cannot', async () => {
  const { app, coto, expense } = await setup();
  const unused = await app.merchants.create({ name: 'Kiosco', defaultCategoryId: null, aliases: [] });
  await app.merchants.remove(unused.id);
  assert.equal((await app.merchants.list()).length, 1);
  await app.transactions.create({ ...expense, merchantId: coto.id });
  assert.equal(await codeOf(app.merchants.remove(coto.id)), 'IN_USE');
});

test('merging merchants moves what was paid there and keeps the names as known texts', async () => {
  const { app, coto, expense } = await setup();
  const other = await app.merchants.create({ name: 'Coto Ciudadela', defaultCategoryId: null, aliases: ['COTO CIUD'] });
  const paid = await app.transactions.create({ ...expense, merchantId: other.id });
  const merged = await app.merchants.merge(other.id, coto.id);
  assert.deepEqual(merged.aliases, ['Coto Ciudadela', 'COTO CIUD']);
  assert.equal((await app.transactions.get(paid.id)).merchantId, coto.id);
  assert.deepEqual((await app.merchants.list()).map((merchant) => merchant.id), [coto.id]);
  assert.equal(await codeOf(app.merchants.merge(coto.id, coto.id)), 'VALIDATION');
});

test('merging products moves the lines, which then count in the category of the other', async () => {
  const { app, pharmacy, yerba, expense, line } = await setup();
  const aspirin = await app.products.create({ name: 'Aspirina', categoryId: pharmacy.id, aliases: [] });
  const created = await app.transactions.create({ ...expense, items: [line({ productId: aspirin.id })] });
  assert.equal(await codeOf(app.products.remove(aspirin.id)), 'IN_USE');
  await app.products.merge(aspirin.id, yerba.id);
  assert.equal((await app.transactions.get(created.id)).items[0]?.productId, yerba.id);
  assert.deepEqual((await app.products.list()).map((product) => product.id), [yerba.id]);
});
