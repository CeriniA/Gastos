import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

async function setup() {
  const app = createMemoryBackend();
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });
  const salary = await app.categories.create({ name: 'Sueldo', kind: 'income', parentId: null });
  return { app, food, salary };
}

test('a merchant is created with a usual category and the texts receipts print for it', async () => {
  const { app, food } = await setup();
  const coto = await app.merchants.create({
    name: 'Coto',
    defaultCategoryId: food.id,
    aliases: ['COTO CICSA 0123', '  coto cicsa 0123 ', 'coto', ''],
  });
  assert.equal(coto.defaultCategoryId, food.id);
  // Repeats and the merchant's own name are not kept.
  assert.deepEqual(coto.aliases, ['COTO CICSA 0123']);
  assert.equal(coto.archived, false);
});

test('a printed text finds its merchant by name or by a known text, ignoring case and accents', async () => {
  const { app } = await setup();
  const cafe = await app.merchants.create({ name: 'Café Martínez', defaultCategoryId: null, aliases: ['CAFE MTZ'] });
  assert.equal((await app.merchants.findByText('cafe martinez'))?.id, cafe.id);
  assert.equal((await app.merchants.findByText('cafe mtz'))?.id, cafe.id);
  assert.equal(await app.merchants.findByText('Starbucks'), null);
  assert.equal(await app.merchants.findByText('  '), null);
});

test('a name or a known text points at one merchant only', async () => {
  const { app } = await setup();
  const coto = await app.merchants.create({ name: 'Coto', defaultCategoryId: null, aliases: ['COTO CICSA'] });
  assert.equal(await codeOf(app.merchants.create({ name: 'coto', defaultCategoryId: null, aliases: [] })), 'DUPLICATE');
  assert.equal(await codeOf(app.merchants.create({ name: 'Otro', defaultCategoryId: null, aliases: ['Coto cicsa'] })), 'DUPLICATE');
  // A known text cannot be the name of another merchant either.
  assert.equal(await codeOf(app.merchants.create({ name: 'Coto Cicsa', defaultCategoryId: null, aliases: [] })), 'DUPLICATE');
  // The same merchant can keep its own texts when it changes something else.
  const renamed = await app.merchants.update(coto.id, { name: 'Coto SA' });
  assert.equal(renamed.name, 'Coto SA');
  assert.deepEqual(renamed.aliases, ['COTO CICSA']);
});

test('the usual category must exist and be an expense category', async () => {
  const { app, food, salary } = await setup();
  assert.equal(
    await codeOf(app.merchants.create({ name: 'Coto', defaultCategoryId: salary.id, aliases: [] })),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.merchants.create({ name: 'Coto', defaultCategoryId: 'a'.repeat(24), aliases: [] })),
    'VALIDATION',
  );
  const coto = await app.merchants.create({ name: 'Coto', defaultCategoryId: food.id, aliases: [] });
  const cleared = await app.merchants.update(coto.id, { defaultCategoryId: null });
  assert.equal(cleared.defaultCategoryId, null);
});

test('a merchant is archived, not deleted, and keeps its texts', async () => {
  const { app } = await setup();
  const coto = await app.merchants.create({ name: 'Coto', defaultCategoryId: null, aliases: ['COTO CICSA'] });
  const archived = await app.merchants.update(coto.id, { archived: true });
  assert.equal(archived.archived, true);
  assert.deepEqual(archived.aliases, ['COTO CICSA']);
  assert.equal(await codeOf(app.merchants.update('b'.repeat(24), { archived: true })), 'NOT_FOUND');
});

test('merging a category moves the usual category of its merchants; deleting it clears them', async () => {
  const { app, food } = await setup();
  const other = await app.categories.create({ name: 'Almacén', kind: 'expense', parentId: null });
  const coto = await app.merchants.create({ name: 'Coto', defaultCategoryId: food.id, aliases: [] });
  await app.categories.merge(food.id, other.id);
  assert.equal((await app.merchants.list()).find((m) => m.id === coto.id)?.defaultCategoryId, other.id);
  await app.categories.remove(other.id);
  assert.equal((await app.merchants.list()).find((m) => m.id === coto.id)?.defaultCategoryId, null);
});
