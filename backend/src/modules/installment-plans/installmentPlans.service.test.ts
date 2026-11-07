import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionCreate } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const visa = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const purchase = (changes: Partial<TransactionCreate> = {}): TransactionCreate => ({
    type: 'expense',
    date: '2026-09-15',
    amountCents: 100001,
    currency: 'ARS',
    accountId: visa.id,
    categoryId: null,
    description: 'Heladera',
    note: '',
    tagIds: [],
    splits: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    refund: false,
    items: [{ name: 'Heladera', amountCents: 100001, product: 'Heladera', group: 'household', quantity: 1 }],
    ...changes,
  });
  return { app, visa, bank, purchase };
}

test('a purchase in installments becomes one transaction per month; future ones are projected', async () => {
  const { app, purchase } = await setup();
  const result = await app.installmentPlans.create({ transaction: purchase(), installments: 3 });
  assert.equal(result.plan.totalAmountCents, 100001);
  assert.deepEqual([result.confirmed, result.projected], [1, 2]);

  const installments = [...app.store.transactions].sort((a, b) => a.date.localeCompare(b.date));
  assert.deepEqual(
    installments.map((transaction) => [
      transaction.date,
      transaction.amountCents,
      transaction.status,
      transaction.installment?.number,
      transaction.source,
    ]),
    [
      ['2026-09-15', 33335, 'confirmed', 1, 'installment'],
      ['2026-10-15', 33333, 'projected', 2, 'installment'],
      ['2026-11-15', 33333, 'projected', 3, 'installment'],
    ],
  );
  // What was bought is listed once.
  assert.equal(installments[0]?.items.length, 1);
  assert.equal(installments[1]?.items.length, 0);
  assert.ok(installments.every((transaction) => transaction.installment?.planId === result.plan.id));

  // Projected installments do not count in a month's balance until they are confirmed.
  assert.equal((await app.transactions.summary('2026-10')).totals.length, 0);
});

test('projected installments are confirmed when their day comes', async () => {
  const { app, purchase } = await setup();
  await app.installmentPlans.create({ transaction: purchase({ date: '2026-09-15' }), installments: 3 });
  assert.equal(await app.transactions.confirmDue(), 0);
  app.calendar.today = '2026-10-15';
  assert.equal(await app.transactions.confirmDue(), 1);
  assert.equal(await app.transactions.confirmDue(), 0);
  assert.deepEqual(app.store.transactions.map((transaction) => transaction.status).sort(), [
    'confirmed',
    'confirmed',
    'projected',
  ]);
});

test('a projected installment in the trash stays projected when its day comes', async () => {
  const { app, purchase } = await setup();
  await app.installmentPlans.create({ transaction: purchase({ date: '2026-09-15' }), installments: 3 });
  const second = app.store.transactions.find((transaction) => transaction.date === '2026-10-15');
  await app.transactions.remove(second!.id);
  app.calendar.today = '2026-10-15';
  assert.equal(await app.transactions.confirmDue(), 0);
  assert.equal(app.store.transactions.find((transaction) => transaction.id === second!.id)?.status, 'projected');
});

test('installments follow the card statements, including future ones', async () => {
  const { app, visa, purchase } = await setup();
  await app.installmentPlans.create({ transaction: purchase({ date: '2026-10-01' }), installments: 2 });
  await app.cardPeriods.create({
    accountIds: [visa.id],
    closingDate: '2026-11-20',
    dueDate: '2026-12-03',
    totalCents: null,
    minimumPaymentCents: null,
  });
  assert.deepEqual(app.store.transactions.map((transaction) => transaction.paymentDate).sort(), [
    '2026-12-03',
    '2026-12-03',
  ]);
  const statement = await app.cardPeriods.statement(visa.id);
  assert.equal(statement.periods[0]?.chargedCents, 100001);
});

test('only card purchases go in installments, and a plan can be sent to the trash whole', async () => {
  const { app, bank, purchase } = await setup();
  assert.equal(
    await codeOf(
      app.installmentPlans.create({ transaction: purchase({ accountId: bank.id }), installments: 3 }),
    ),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.installmentPlans.create({ transaction: purchase({ type: 'income' }), installments: 3 })),
    'VALIDATION',
  );
  // The whole thing is checked before anything is stored.
  assert.equal(app.store.installmentPlans.length, 0);
  assert.equal(app.store.transactions.length, 0);

  const { plan } = await app.installmentPlans.create({ transaction: purchase(), installments: 6 });
  assert.equal(await app.installmentPlans.remove(plan.id), 6);
  assert.ok(app.store.transactions.every((transaction) => transaction.deletedAt !== null));
  assert.equal(await codeOf(app.installmentPlans.remove('f'.repeat(24))), 'NOT_FOUND');
});

test('a purchase the day before the closing is paid in consecutive statements', async () => {
  const { app, visa, purchase } = await setup();
  for (const [closingDate, dueDate] of [
    ['2026-09-08', '2026-09-20'],
    ['2026-10-05', '2026-10-17'],
    ['2026-11-04', '2026-11-16'],
  ] as const) {
    await app.cardPeriods.create({
      accountIds: [visa.id],
      closingDate,
      dueDate,
      totalCents: null,
      minimumPaymentCents: null,
    });
  }
  await app.installmentPlans.create({ transaction: purchase({ date: '2026-09-07' }), installments: 3 });
  assert.deepEqual(
    app.store.transactions.map((transaction) => transaction.paymentDate),
    ['2026-09-20', '2026-10-17', '2026-11-16'],
  );
});
