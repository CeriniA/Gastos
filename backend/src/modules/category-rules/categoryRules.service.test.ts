import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

async function setup() {
  const app = createMemoryBackend();
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });
  const home = await app.categories.create({ name: 'Vivienda', kind: 'expense', parentId: null });
  return { app, food, home };
}

test('there is one rule per merchant, whatever the spelling', async () => {
  const { app, food, home } = await setup();
  const first = await app.categoryRules.save({ merchant: 'Coto', categoryId: food.id });
  const second = await app.categoryRules.save({ merchant: ' COTÓ ', categoryId: home.id });
  assert.equal(second.id, first.id);
  assert.deepEqual(
    (await app.categoryRules.list()).map((rule) => rule.categoryId),
    [home.id],
  );
  assert.deepEqual([...(await app.categoryRules.lookup())], [['coto', home.id]]);
});

test('a rule needs an existing, active category', async () => {
  const { app, food } = await setup();
  assert.equal(
    await codeOf(app.categoryRules.save({ merchant: 'Coto', categoryId: 'f'.repeat(24) })),
    'VALIDATION',
  );
  await app.categories.update(food.id, { archived: true });
  assert.equal(await codeOf(app.categoryRules.save({ merchant: 'Coto', categoryId: food.id })), 'VALIDATION');
});

test('rules follow a merged category and go away with a deleted one', async () => {
  const { app, food, home } = await setup();
  await app.categoryRules.save({ merchant: 'Coto', categoryId: food.id });
  const rule = await app.categoryRules.save({ merchant: 'Edesur', categoryId: home.id });

  await app.categories.merge(food.id, home.id);
  assert.deepEqual(
    (await app.categoryRules.list()).map((item) => item.categoryId),
    [home.id, home.id],
  );

  await app.categories.remove(home.id);
  assert.deepEqual(await app.categoryRules.list(), []);
  assert.equal(await codeOf(app.categoryRules.remove(rule.id)), 'NOT_FOUND');
});
