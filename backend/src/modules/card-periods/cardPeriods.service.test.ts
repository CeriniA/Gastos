import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionCreate } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const visa = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  const visaUsd = await app.accounts.create({ name: 'Visa USD', type: 'credit_card', currency: 'USD' });
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const buy = (date: string, amountCents: number, accountId = visa.id): Promise<{ id: string }> => {
    const input: TransactionCreate = {
      type: 'expense',
      date,
      amountCents,
      currency: 'ARS',
      accountId,
      categoryId: null,
      description: '',
      note: '',
      tagIds: [],
      splits: [],
      toAccountId: null,
      toAmountCents: null,
      paymentDate: null,
      original: null,
      refund: false,
      items: [],
    };
    return app.transactions.create(input);
  };
  const paidOn = (id: string) =>
    app.store.transactions.find((transaction) => transaction.id === id)?.paymentDate;
  return { app, visa, visaUsd, bank, buy, paidOn };
}

test('a card purchase is paid on the due date of its statement, set once and kept up to date', async () => {
  const { app, visa, visaUsd, buy, paidOn } = await setup();
  const september = await buy('2026-09-20', 10000);
  const early = await buy('2026-10-01', 20000);
  const late = await buy('2026-10-08', 30000);
  // Without statements, a card purchase is paid the day it happens.
  assert.equal(paidOn(september.id), '2026-09-20');

  // One statement for the card in pesos and the one in dollars.
  const [first, firstUsd] = await app.cardPeriods.create({
    accountIds: [visa.id, visaUsd.id],
    closingDate: '2026-09-25',
    dueDate: '2026-10-06',
    totalCents: null,
    minimumPaymentCents: null,
  });
  assert.equal(firstUsd?.accountId, visaUsd.id);
  assert.equal(paidOn(september.id), '2026-10-06');
  assert.equal(paidOn(early.id), '2026-10-01'); // after that closing: still its own date

  const [second] = await app.cardPeriods.create({
    accountIds: [visa.id],
    closingDate: '2026-10-23',
    dueDate: '2026-11-05',
    totalCents: 50000,
    minimumPaymentCents: null,
  });
  assert.equal(paidOn(early.id), '2026-11-05');
  assert.equal(paidOn(late.id), '2026-11-05');
  // A purchase made now lands in its statement straight away.
  assert.equal(paidOn((await buy('2026-10-09', 5000)).id), '2026-11-05');

  // The monthly balance follows: October only pays the September purchase.
  const october = await app.transactions.summary('2026-10');
  assert.equal(october.totals[0]?.expenseCents, 10000);
  assert.equal((await app.transactions.summary('2026-11')).totals[0]?.expenseCents, 55000);

  // What each statement charges, to compare with the bank's.
  const statement = await app.cardPeriods.statement(visa.id);
  assert.deepEqual(
    statement.periods.map((period) => [period.dueDate, period.chargedCents, period.transactionCount]),
    [
      ['2026-11-05', 55000, 3],
      ['2026-10-06', 10000, 1],
    ],
  );
  assert.deepEqual(statement.open, { since: '2026-10-23', chargedCents: 0, transactionCount: 0 });

  // Correcting a closing moves the purchases with it.
  await app.cardPeriods.update(first!.id, { closingDate: '2026-09-19' });
  assert.equal(paidOn(september.id), '2026-11-05');

  // Deleting a statement sends its purchases back to their own date.
  await app.cardPeriods.remove(second!.id);
  assert.equal(paidOn(early.id), '2026-10-01');
  assert.equal(paidOn(september.id), '2026-09-20');
});

test('statements belong to credit cards, one per closing day, due after closing', async () => {
  const { app, visa, bank } = await setup();
  const dates = {
    closingDate: '2026-09-25',
    dueDate: '2026-10-06',
    totalCents: null,
    minimumPaymentCents: null,
  };
  assert.equal(await codeOf(app.cardPeriods.create({ ...dates, accountIds: [bank.id] })), 'VALIDATION');

  const [period] = await app.cardPeriods.create({ ...dates, accountIds: [visa.id] });
  assert.equal(await codeOf(app.cardPeriods.create({ ...dates, accountIds: [visa.id] })), 'DUPLICATE');
  assert.equal(await codeOf(app.cardPeriods.update(period!.id, { dueDate: '2026-09-20' })), 'VALIDATION');

  // A card with statements is not deleted by accident.
  assert.equal(await codeOf(app.accounts.remove(visa.id)), 'IN_USE');
});

test('paying a statement is a transfer to the card, linked to it, and never an expense', async () => {
  const { app, visa, visaUsd, bank, buy } = await setup();
  await buy('2026-09-20', 10000);
  const [period, periodUsd] = await app.cardPeriods.create({
    accountIds: [visa.id, visaUsd.id],
    closingDate: '2026-09-25',
    dueDate: '2026-10-06',
    totalCents: 10000,
    minimumPaymentCents: null,
  });
  const paid = async (accountId = visa.id) =>
    (await app.cardPeriods.statement(accountId)).periods[0]?.paidCents;
  assert.equal(await paid(), 0);

  // In two parts: the statement adds them up.
  const first = await app.cardPeriods.pay(period!.id, {
    accountId: bank.id,
    date: '2026-10-06',
    amountCents: 4000,
    toAmountCents: null,
  });
  await app.cardPeriods.pay(period!.id, {
    accountId: bank.id,
    date: '2026-10-08',
    amountCents: 6000,
    toAmountCents: null,
  });
  assert.deepEqual(
    [first.type, first.accountId, first.toAccountId, first.cardPeriodId],
    ['transfer', bank.id, visa.id, period!.id],
  );
  assert.equal(await paid(), 10000);
  // The month still spends what was bought, once.
  assert.equal((await app.transactions.summary('2026-10')).totals[0]?.expenseCents, 10000);

  // Dollars paid with pesos: what counts for the statement is what reached the card.
  const fromPesos = { accountId: bank.id, date: '2026-10-06', amountCents: 150000 };
  assert.equal(
    await codeOf(app.cardPeriods.pay(periodUsd!.id, { ...fromPesos, toAmountCents: null })),
    'VALIDATION',
  );
  await app.cardPeriods.pay(periodUsd!.id, { ...fromPesos, toAmountCents: 10000 });
  assert.equal(await paid(visaUsd.id), 10000);

  // Not from the card itself, not from an account that is not there, not dated ahead.
  const good = { date: '2026-10-06', amountCents: 100, toAmountCents: null };
  assert.equal(await codeOf(app.cardPeriods.pay(period!.id, { ...good, accountId: visa.id })), 'VALIDATION');
  assert.equal(
    await codeOf(app.cardPeriods.pay(period!.id, { ...good, accountId: 'f'.repeat(24) })),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.cardPeriods.pay(period!.id, { ...good, accountId: bank.id, date: '2026-10-11' })),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.cardPeriods.pay('f'.repeat(24), { ...good, accountId: bank.id })),
    'NOT_FOUND',
  );

  // A payment sent to the trash stops counting; a deleted statement leaves its payments as transfers.
  await app.transactions.remove(first.id);
  assert.equal(await paid(), 6000);
  await app.cardPeriods.remove(period!.id);
  const left = app.store.transactions.filter((transaction) => transaction.toAccountId === visa.id);
  assert.deepEqual(
    left.map((transaction) => transaction.cardPeriodId),
    [null, null],
  );
});
