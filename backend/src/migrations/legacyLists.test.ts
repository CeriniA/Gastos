import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupsInUse, planLists, type LegacyInput, type LegacyTransaction } from './legacyLists';

const FOOD = 'f'.repeat(24);
const HOME = 'a'.repeat(24);
const PANTRY = 'b'.repeat(24);

const transaction = (
  description: string,
  categoryId: string | null = FOOD,
  items: LegacyTransaction['items'] = [],
): LegacyTransaction => ({ description, categoryId, items });

function input(overrides: Partial<LegacyInput>): LegacyInput {
  return {
    transactions: [],
    categoryRules: [],
    productRules: [],
    expenseCategoryIds: new Set([FOOD, HOME, PANTRY]),
    groupCategories: { pantry: PANTRY },
    ...overrides,
  };
}

test('descriptions that differ in case or accents become one merchant, with the most common spelling', () => {
  const plan = planLists(
    input({
      transactions: [transaction('Café Martínez'), transaction('CAFE MARTINEZ'), transaction('Café Martínez'), transaction('  ')],
    }),
  );
  assert.deepEqual(plan.merchants, [{ name: 'Café Martínez', defaultCategoryId: null }]);
});

test('a category rule gives the merchant its usual category, even when no transaction has the merchant', () => {
  const plan = planLists(
    input({
      transactions: [transaction('Coto')],
      categoryRules: [
        { merchant: 'coto', categoryId: FOOD },
        { merchant: 'Edesur', categoryId: HOME },
        { merchant: 'Gone', categoryId: 'c'.repeat(24) },
      ],
    }),
  );
  const byName = Object.fromEntries(plan.merchants.map((merchant) => [merchant.name, merchant.defaultCategoryId]));
  assert.deepEqual(byName, { Coto: FOOD, Edesur: HOME, Gone: null });
});

test('long descriptions are cut to the length a name can have', () => {
  const plan = planLists(input({ transactions: [transaction('x'.repeat(150))] }));
  assert.equal(plan.merchants[0]?.name.length, 60);
});

test('a product takes its group category and the printed lines as known texts', () => {
  const plan = planLists(
    input({
      transactions: [
        transaction('Coto', FOOD, [
          { name: 'YERB.PLAY 1000', product: 'Yerba', group: 'pantry' },
          { name: 'YERBA PLAYADITO', product: 'yerba', group: 'pantry' },
          { name: 'Yerba', product: 'Yerba', group: 'pantry' },
        ]),
      ],
      productRules: [{ name: 'YERB.PLAY 1000', product: 'Yerba', group: 'pantry' }],
    }),
  );
  assert.deepEqual(plan.products, [
    { name: 'Yerba', categoryId: PANTRY, aliases: ['YERB.PLAY 1000', 'YERBA PLAYADITO'] },
  ]);
});

test('without a group, a product takes the usual category of the purchases it came from', () => {
  const plan = planLists(
    input({
      transactions: [
        transaction('A', HOME, [{ name: 'Foco', product: 'Foco', group: null }]),
        transaction('B', HOME, [{ name: 'Foco LED', product: 'Foco', group: null }]),
        transaction('C', FOOD, [{ name: 'Foco', product: 'Foco', group: null }]),
      ],
    }),
  );
  assert.equal(plan.products[0]?.categoryId, HOME);
});

test('a product with no group and no usable category is left out and counted', () => {
  const plan = planLists(
    input({ transactions: [transaction('A', null, [{ name: 'Algo', product: 'Algo', group: null }])] }),
  );
  assert.deepEqual([plan.products, plan.productsWithoutCategory], [[], 1]);
});

test('a printed text belongs to one product: the name of another keeps it', () => {
  const plan = planLists(
    input({
      transactions: [
        transaction('A', FOOD, [
          { name: 'Leche', product: 'Leche', group: 'pantry' },
          { name: 'Leche', product: 'Leche entera', group: 'pantry' },
          { name: 'LECHE ENT', product: 'Leche entera', group: 'pantry' },
        ]),
      ],
    }),
  );
  const byName = Object.fromEntries(plan.products.map((product) => [product.name, product.aliases]));
  assert.deepEqual(byName, { Leche: [], 'Leche entera': ['LECHE ENT'] });
});

test('only the groups the data uses become categories', () => {
  const used = groupsInUse({
    transactions: [
      transaction('A', FOOD, [
        { name: 'x', product: 'X', group: 'pantry' },
        { name: 'y', product: '', group: 'meat' },
        { name: 'z', product: 'Z', group: 'not_a_group' },
      ]),
    ],
    productRules: [{ name: 'q', product: 'Q', group: 'dairy' }],
  });
  assert.deepEqual(used.sort(), ['dairy', 'pantry']);
});
