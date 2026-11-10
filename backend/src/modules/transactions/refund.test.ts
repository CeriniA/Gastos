import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionCreate } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

/** A refund is an expense that takes away: from the month, the card's statement and consumption. */

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const visa = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  const clothes = await app.categories.create({ name: 'Ropa', kind: 'expense', parentId: null });
  const salary = await app.categories.create({ name: 'Sueldo', kind: 'income', parentId: null });
  const entry = (changes: Partial<TransactionCreate> = {}): TransactionCreate => ({
    type: 'expense',
    date: '2026-10-02',
    amountCents: 500000,
    currency: 'ARS',
    accountId: visa.id,
    categoryId: clothes.id,
    description: 'Zapatillas',
    merchantId: null,
    note: '',
    tagIds: [],
    splits: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    refund: false,
    items: [
      { name: 'Zapatillas', amountCents: 500000, product: 'Zapatillas', group: 'household', quantity: 1, productId: null, categoryId: null },
    ],
    ...changes,
  });
  return { app, visa, clothes, salary, entry };
}

test('a refund takes away from the month and from the card statement', async () => {
  const { app, visa, entry } = await setup();
  await app.cardPeriods.create({
    accountIds: [visa.id],
    closingDate: '2026-10-08',
    dueDate: '2026-10-20',
    totalCents: null,
    minimumPaymentCents: null,
  });
  await app.transactions.create(entry());
  await app.transactions.create(entry({ date: '2026-10-05', amountCents: 200000, refund: true }));

  assert.deepEqual((await app.transactions.summary('2026-10')).totals, [
    { currency: 'ARS', incomeCents: 0, expenseCents: 300000, balanceCents: -300000 },
  ]);
  const [period] = (await app.cardPeriods.statement(visa.id)).periods;
  assert.equal(period?.chargedCents, 300000);
  assert.equal(period?.transactionCount, 2);
});

test('the products given back count against what was bought, and are not purchases', async () => {
  const { app, entry } = await setup();
  await app.transactions.create(entry());
  await app.transactions.create(entry({ date: '2026-10-05', refund: true }));
  const [currency] = (await app.consumption.summary('2026-10')).currencies;
  assert.deepEqual(currency?.groups[0]?.products, [
    { product: 'Zapatillas', totalCents: 0, purchases: 1, quantity: 0 },
  ]);
});

test('only an expense paid at once can be a refund', async () => {
  const { app, salary, entry } = await setup();
  assert.equal(
    await codeOf(
      app.transactions.create(entry({ type: 'income', categoryId: salary.id, items: [], refund: true })),
    ),
    'VALIDATION',
  );
  const stored = await app.transactions.create(entry({ refund: true }));
  // Turning it into an income without clearing the mark is refused too.
  assert.equal(
    await codeOf(app.transactions.update(stored.id, { type: 'income', categoryId: salary.id, items: [] })),
    'VALIDATION',
  );
  assert.equal((await app.transactions.update(stored.id, { refund: false })).refund, false);

  assert.equal(
    await codeOf(app.installmentPlans.create({ transaction: entry({ refund: true }), installments: 3 })),
    'VALIDATION',
  );
});
