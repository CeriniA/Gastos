import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductGroup, TransactionItem } from '@gastos/shared';
import { createMemoryBackend } from '../../testing/memory';

function line(
  name: string,
  amountCents: number,
  product = '',
  group: ProductGroup | null = null,
  quantity: number | null = null,
): TransactionItem {
  return { name, amountCents, product, group, quantity, productId: null, categoryId: null };
}

async function setup() {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const wallet = await app.accounts.create({ name: 'Billetera', type: 'cash', currency: 'USD' });
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });

  const buy = async (date: string, description: string, items: TransactionItem[], account = bank) => {
    const amountCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    await app.transactions.createMany(
      [
        {
          input: {
            type: 'expense',
            date,
            amountCents,
            currency: account.currency,
            accountId: account.id,
            categoryId: food.id,
            description,
            merchantId: null,
            note: '',
            tagIds: [],
            splits: [],
            toAccountId: null,
            toAmountCents: null,
            paymentDate: null,
            original: null,
            refund: false,
            items,
          },
          installment: null,
        },
      ],
      'document',
      {},
    );
    const created = app.store.transactions.at(-1);
    assert.ok(created);
    return created;
  };
  return { app, buy, wallet };
}

test('a month is added up by group and product, largest first', async () => {
  const { app, buy } = await setup();
  await buy('2026-10-03', 'Koch', [
    line('LEITE INTEGRAL 1L', 60000, 'leche', 'dairy', 2),
    line('PAO FRANCES', 25000, 'Pan', 'bakery', 0.5),
    line('ARROZ TIO J 5KG', 90000, 'Arroz', 'pantry', 1),
  ]);
  await buy('2026-10-08', 'Angeloni', [
    line('LEITE DESN', 35000, 'Leche', 'dairy', 1),
    line('QUEIJO MUSS', 80000, 'Queso', 'dairy'),
  ]);
  await buy('2026-09-30', 'Koch', [line('LEITE', 99999, 'Leche', 'dairy', 3)]);

  const summary = await app.consumption.summary('2026-10');
  assert.equal(summary.currencies.length, 1);
  const [ars] = summary.currencies;
  assert.equal(ars?.currency, 'ARS');
  assert.equal(ars?.totalCents, 290000);
  assert.deepEqual(
    ars?.groups.map((group) => [group.group, group.totalCents]),
    [
      ['dairy', 175000],
      ['pantry', 90000],
      ['bakery', 25000],
    ],
  );
  assert.deepEqual(ars?.groups[0]?.products, [
    { product: 'Leche', totalCents: 95000, purchases: 2, quantity: 3 },
    { product: 'Queso', totalCents: 80000, purchases: 1, quantity: null },
  ]);
});

test('lines without a product or a group are still counted', async () => {
  const { app, buy } = await setup();
  await buy('2026-10-03', 'Kiosco', [
    line('ALFAJOR', 1500),
    line('alfajor', 1500),
    line('Yerba', 4000, 'Yerba', 'pantry'),
  ]);

  const [ars] = (await app.consumption.summary('2026-10')).currencies;
  assert.deepEqual(
    ars?.groups.map((group) => group.group),
    ['pantry', null],
  );
  assert.deepEqual(ars?.groups[1]?.products, [
    { product: 'ALFAJOR', totalCents: 3000, purchases: 2, quantity: null },
  ]);
});

test('currencies are never added together', async () => {
  const { app, buy, wallet } = await setup();
  await buy('2026-10-03', 'Koch', [line('Leche', 1000, 'Leche', 'dairy', 1)]);
  await buy('2026-10-04', 'Duty free', [line('Milk', 300, 'Leche', 'dairy', 1)], wallet);

  const summary = await app.consumption.summary('2026-10');
  assert.deepEqual(summary.currencies.map((entry) => [entry.currency, entry.totalCents]).sort(), [
    ['ARS', 1000],
    ['USD', 300],
  ]);
});

test('purchases sent to the trash leave the report', async () => {
  const { app, buy } = await setup();
  const purchase = await buy('2026-10-03', 'Koch', [line('Leche', 1000, 'Leche', 'dairy', 1)]);
  await app.transactions.remove(purchase.id);
  assert.deepEqual((await app.consumption.summary('2026-10')).currencies, []);
});

test('a product can be searched by its name or by the ticket text', async () => {
  const { app, buy } = await setup();
  await buy('2026-09-10', 'Koch', [line('CAFE PILAO 500G', 70000, 'Café', 'pantry', 1)]);
  await buy('2026-10-03', 'Angeloni', [
    line('CAFE MELITTA', 82000, 'Café', 'pantry', 1),
    line('LEITE', 30000, 'Leche', 'dairy', 1),
  ]);

  const coffee = await app.consumption.search({ q: 'cafe' });
  assert.deepEqual(
    coffee.map((item) => [item.date, item.description, item.amountCents]),
    [
      ['2026-10-03', 'Angeloni', 82000],
      ['2026-09-10', 'Koch', 70000],
    ],
  );
  assert.equal((await app.consumption.search({ q: 'pilao' })).length, 1);
  assert.equal((await app.consumption.search({ q: 'café', from: '2026-10-01' })).length, 1);
  assert.equal((await app.consumption.search({ q: 'yerba' })).length, 0);
});
