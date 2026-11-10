import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filedAmounts, type Filable } from './splits';

const FOOD = 'food';
const PHARMACY = 'pharmacy';
const DAIRY = 'dairy';
const productCategories = new Map([
  ['milk', DAIRY],
  ['aspirin', PHARMACY],
]);

const purchase = (overrides: Partial<Filable>): Filable => ({
  id: 't1',
  date: '2026-10-05',
  type: 'expense',
  refund: false,
  currency: 'ARS',
  amountCents: 100000,
  categoryId: FOOD,
  splits: [],
  items: [],
  ...overrides,
});

const line = (amountCents: number, extra: object) => ({
  name: 'x',
  amountCents,
  product: '',
  group: null,
  quantity: null,
  productId: null,
  categoryId: null,
  ...extra,
});

const byCategory = (filed: ReturnType<typeof filedAmounts>) =>
  Object.fromEntries(filed.map((part) => [part.categoryId, part.cents]));

test('without lines, all of it goes to the category of the purchase', () => {
  assert.deepEqual(byCategory(filedAmounts(purchase({}), productCategories)), { [FOOD]: 100000 });
});

test('each line goes to the category of its product, and the rest stays in the purchase category', () => {
  const filed = filedAmounts(
    purchase({
      items: [
        line(30000, { productId: 'milk' }),
        line(20000, { productId: 'aspirin' }),
        line(10000, {}), // a line nobody classified is part of the rest
      ],
    }),
    productCategories,
  );
  assert.deepEqual(byCategory(filed), { [DAIRY]: 30000, [PHARMACY]: 20000, [FOOD]: 50000 });
  assert.equal(filed.reduce((sum, part) => sum + part.cents, 0), 100000);
});

test('a line without a product files under its own category', () => {
  const filed = filedAmounts(purchase({ items: [line(40000, { categoryId: PHARMACY })] }), productCategories);
  assert.deepEqual(byCategory(filed), { [PHARMACY]: 40000, [FOOD]: 60000 });
});

test('lines that cover the whole purchase leave nothing in its category, and the total never changes', () => {
  const covered = filedAmounts(
    purchase({ items: [line(60000, { productId: 'milk' }), line(40000, { productId: 'aspirin' })] }),
    productCategories,
  );
  assert.deepEqual(byCategory(covered), { [DAIRY]: 60000, [PHARMACY]: 40000 });
  // Lines that add up to more than the total (a discount is missing): the rest is negative.
  const over = filedAmounts(purchase({ items: [line(120000, { productId: 'milk' })] }), productCategories);
  assert.equal(over.reduce((sum, part) => sum + part.cents, 0), 100000);
});

test('a refund takes away from the category of each line', () => {
  const filed = filedAmounts(
    purchase({ refund: true, items: [line(30000, { productId: 'milk' })] }),
    productCategories,
  );
  assert.deepEqual(byCategory(filed), { [DAIRY]: -30000, [FOOD]: -70000 });
});

test('a divided purchase files each part, and a transfer or an income ignores the lines', () => {
  const divided = filedAmounts(
    purchase({ categoryId: null, splits: [{ categoryId: FOOD, amountCents: 70000 }, { categoryId: PHARMACY, amountCents: 30000 }] }),
  );
  assert.deepEqual(byCategory(divided), { [FOOD]: 70000, [PHARMACY]: 30000 });
  assert.deepEqual(filedAmounts(purchase({ type: 'transfer' })), []);
  const income = filedAmounts(purchase({ type: 'income', items: [line(1000, { categoryId: PHARMACY })] }));
  assert.deepEqual(byCategory(income), { [FOOD]: 100000 });
});
