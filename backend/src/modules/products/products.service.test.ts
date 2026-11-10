import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

async function setup() {
  const app = createMemoryBackend();
  const pantry = await app.categories.create({ name: 'Almacén', kind: 'expense', parentId: null });
  const salary = await app.categories.create({ name: 'Sueldo', kind: 'income', parentId: null });
  return { app, pantry, salary };
}

test('a product has a name, a category and the texts receipts print for it', async () => {
  const { app, pantry } = await setup();
  const yerba = await app.products.create({
    name: 'Yerba',
    categoryId: pantry.id,
    aliases: ['YERB.PLAY 1000', 'yerb.play 1000'],
  });
  assert.equal(yerba.categoryId, pantry.id);
  assert.deepEqual(yerba.aliases, ['YERB.PLAY 1000']);
  assert.equal((await app.products.findByText('yerb.play 1000'))?.id, yerba.id);
  assert.equal(await app.products.findByText('Fideos'), null);
});

test('a product needs an existing expense category', async () => {
  const { app, salary } = await setup();
  assert.equal(await codeOf(app.products.create({ name: 'Yerba', categoryId: salary.id, aliases: [] })), 'VALIDATION');
  assert.equal(
    await codeOf(app.products.create({ name: 'Yerba', categoryId: 'a'.repeat(24), aliases: [] })),
    'VALIDATION',
  );
});

test('a name or a known text points at one product only', async () => {
  const { app, pantry } = await setup();
  await app.products.create({ name: 'Yerba', categoryId: pantry.id, aliases: ['YERB.PLAY 1000'] });
  assert.equal(await codeOf(app.products.create({ name: 'yerba', categoryId: pantry.id, aliases: [] })), 'DUPLICATE');
  assert.equal(
    await codeOf(app.products.create({ name: 'Mate', categoryId: pantry.id, aliases: ['Yerb.Play 1000'] })),
    'DUPLICATE',
  );
});

test('a product changes category and is archived, never deleted', async () => {
  const { app, pantry } = await setup();
  const drinks = await app.categories.create({ name: 'Bebidas', kind: 'expense', parentId: null });
  const yerba = await app.products.create({ name: 'Yerba', categoryId: pantry.id, aliases: [] });
  assert.equal((await app.products.update(yerba.id, { categoryId: drinks.id })).categoryId, drinks.id);
  assert.equal((await app.products.update(yerba.id, { archived: true })).archived, true);
  assert.equal(await codeOf(app.products.update('b'.repeat(24), { archived: true })), 'NOT_FOUND');
});

test('a category with products cannot be deleted, and merging it moves them', async () => {
  const { app, pantry } = await setup();
  const drinks = await app.categories.create({ name: 'Bebidas', kind: 'expense', parentId: null });
  const yerba = await app.products.create({ name: 'Yerba', categoryId: pantry.id, aliases: [] });
  assert.equal(await codeOf(app.categories.remove(pantry.id)), 'IN_USE');
  await app.categories.merge(pantry.id, drinks.id);
  assert.equal((await app.products.list()).find((p) => p.id === yerba.id)?.categoryId, drinks.id);
});
