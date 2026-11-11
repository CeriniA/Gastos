import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundError } from '../../core/errors/errors';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

const part = (categoryId: string, amountCents: number) => ({
  name: '',
  amountCents,
  product: '',
  group: null,
  quantity: null,
  productId: null,
  categoryId,
});

async function tree() {
  const app = createMemoryBackend();
  const home = await app.categories.create({ name: 'Vivienda', kind: 'expense', parentId: null });
  const services = await app.categories.create({ name: 'Servicios', kind: 'expense', parentId: home.id });
  const power = await app.categories.create({ name: 'Luz', kind: 'expense', parentId: services.id });
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });
  const salary = await app.categories.create({ name: 'Sueldo', kind: 'income', parentId: null });
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  return { app, home, services, power, food, salary, bank };
}

test('depth is derived from the tree and capped at three levels', async () => {
  const { app, home, services, power } = await tree();
  assert.deepEqual([home.depth, services.depth, power.depth], [1, 2, 3]);
  assert.equal(
    await codeOf(app.categories.create({ name: 'Edesur', kind: 'expense', parentId: power.id })),
    'VALIDATION',
  );
});

test('siblings cannot share a name, ignoring case and accents; cousins can', async () => {
  const { app, home, food } = await tree();
  assert.equal(
    await codeOf(app.categories.create({ name: 'servicios', kind: 'expense', parentId: home.id })),
    'DUPLICATE',
  );
  assert.equal(
    await codeOf(app.categories.create({ name: 'VIVIENDA ', kind: 'expense', parentId: null })),
    'DUPLICATE',
  );
  await app.categories.create({ name: 'Servicios', kind: 'expense', parentId: food.id });
  await app.categories.create({ name: 'Vivienda', kind: 'income', parentId: null });
});

test('a parent must exist and be of the same kind', async () => {
  const { app, salary } = await tree();
  assert.equal(
    await codeOf(app.categories.create({ name: 'X', kind: 'expense', parentId: salary.id })),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.categories.create({ name: 'X', kind: 'expense', parentId: 'f'.repeat(24) })),
    'VALIDATION',
  );
});

test('moving a branch keeps it valid: no cycles, no fourth level', async () => {
  const { app, home, services, power, food } = await tree();
  assert.equal(await codeOf(app.categories.update(home.id, { parentId: power.id })), 'VALIDATION');
  assert.equal(await codeOf(app.categories.update(home.id, { parentId: home.id })), 'VALIDATION');
  assert.equal(await codeOf(app.categories.update(home.id, { parentId: food.id })), 'VALIDATION');

  const moved = await app.categories.update(services.id, { parentId: food.id });
  assert.equal(moved.parentId, food.id);
  assert.equal(moved.depth, 2);
  assert.equal((await app.categories.get(power.id)).depth, 3);

  const root = await app.categories.update(power.id, { parentId: null });
  assert.equal(root.depth, 1);
});

test('renaming respects the sibling rule and keeps the id', async () => {
  const { app, home, food } = await tree();
  assert.equal(await codeOf(app.categories.update(food.id, { name: 'vivienda' })), 'DUPLICATE');
  const renamed = await app.categories.update(food.id, { name: 'Almacén' });
  assert.equal(renamed.id, food.id);
  assert.equal(renamed.name, 'Almacén');
  assert.equal((await app.categories.update(home.id, { name: 'Vivienda' })).name, 'Vivienda');
});

test('a category in use cannot be deleted, only archived or merged', async () => {
  const { app, home, power, food, bank } = await tree();
  assert.equal(await codeOf(app.categories.remove(home.id)), 'IN_USE'); // has subcategories

  const expense = await app.transactions.create({
    type: 'expense',
    date: '2026-10-05',
    amountCents: 500000,
    currency: 'ARS',
    accountId: bank.id,
    categoryId: power.id,
    description: 'Edesur',
    merchantId: null,
    note: '',
    tagIds: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    refund: false,
    items: [],
  });
  assert.equal(await codeOf(app.categories.remove(power.id)), 'IN_USE');

  // Still in use while the transaction sits in the trash: it can be restored.
  await app.transactions.remove(expense.id);
  assert.equal(await codeOf(app.categories.remove(power.id)), 'IN_USE');
  await app.transactions.restore(expense.id);

  await app.categories.update(power.id, { archived: true });
  assert.equal((await app.transactions.get(expense.id)).categoryId, power.id);

  await app.categories.remove(food.id);
  await assert.rejects(app.categories.get(food.id), NotFoundError);
});

test('merging moves the transactions, including their lines, and deletes the source', async () => {
  const { app, home, services, power, food, salary, bank } = await tree();
  const base = {
    type: 'expense' as const,
    date: '2026-10-05',
    currency: 'ARS' as const,
    accountId: bank.id,
    description: '',
    merchantId: null,
    note: '',
    tagIds: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    refund: false,
    items: [],
  };
  const single = await app.transactions.create({
    ...base,
    amountCents: 1000,
    categoryId: power.id,
  });
  const split = await app.transactions.create({
    ...base,
    amountCents: 3000,
    categoryId: food.id,
    items: [part(power.id, 1000), part(food.id, 2000)],
  });

  assert.equal(await codeOf(app.categories.merge(power.id, power.id)), 'VALIDATION');
  assert.equal(await codeOf(app.categories.merge(power.id, salary.id)), 'VALIDATION');
  assert.equal(await codeOf(app.categories.merge(home.id, food.id)), 'CONFLICT'); // has subcategories

  await app.categories.merge(power.id, services.id);
  assert.equal((await app.transactions.get(single.id)).categoryId, services.id);
  assert.deepEqual(
    (await app.transactions.get(split.id)).items.map((line) => line.categoryId),
    [services.id, food.id],
  );
  await assert.rejects(app.categories.get(power.id), NotFoundError);
  assert.equal(await app.transactions.countByCategory(services.id), 2);

  // Merging the two categories the lines of a transaction are in leaves them in the same one.
  await app.categories.merge(food.id, services.id);
  const whole = await app.transactions.get(split.id);
  assert.deepEqual(
    [whole.categoryId, ...whole.items.map((line) => line.categoryId)],
    [services.id, services.id, services.id],
  );
});

test('filtering transactions by a category includes its subcategories', async () => {
  const { app, home, power, food, bank } = await tree();
  const base = {
    type: 'expense' as const,
    date: '2026-10-05',
    currency: 'ARS' as const,
    accountId: bank.id,
    description: '',
    merchantId: null,
    note: '',
    tagIds: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    refund: false,
    items: [],
  };
  await app.transactions.create({ ...base, amountCents: 1000, categoryId: power.id });
  await app.transactions.create({ ...base, amountCents: 2000, categoryId: food.id });
  const underHome = await app.transactions.list({ page: 1, pageSize: 50, categoryId: home.id });
  assert.deepEqual(
    underHome.items.map((item) => item.amountCents),
    [1000],
  );
});

test('a category with a role keeps it when renamed and cannot be deleted or merged away', async () => {
  const { app, food } = await tree();
  const charges = await app.categories.create({
    name: 'Cargos',
    kind: 'expense',
    parentId: null,
    role: 'financial_charges',
  });
  assert.equal(charges.role, 'financial_charges');
  assert.equal(food.role, null);
  const renamed = await app.categories.update(charges.id, { name: 'Intereses y comisiones' });
  assert.equal(renamed.role, 'financial_charges');
  assert.equal(await codeOf(app.categories.remove(charges.id)), 'CONFLICT');
  assert.equal(await codeOf(app.categories.merge(charges.id, food.id)), 'CONFLICT');
});
