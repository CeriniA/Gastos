import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../../core/errors/errors';
import { createMemoryBackend } from '../../testing/memory';

async function codeOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof AppError, `expected an AppError, got ${String(error)}`);
    return error.code;
  }
  assert.fail('expected the operation to be rejected');
}

const expense = (accountId: string, tagIds: string[] = []) => ({
  type: 'expense' as const,
  date: '2026-10-05',
  amountCents: 1000,
  currency: 'ARS' as const,
  accountId,
  categoryId: null,
  description: '',
  note: '',
  tagIds,
  splits: [],
  toAccountId: null,
  toAmountCents: null,
  paymentDate: null,
});

test('account names are unique whatever the case or accents', async () => {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco Nación', type: 'bank', currency: 'ARS' });
  assert.equal(
    await codeOf(app.accounts.create({ name: 'banco nacion', type: 'cash', currency: 'USD' })),
    'DUPLICATE',
  );
  const other = await app.accounts.create({ name: 'Efectivo', type: 'cash', currency: 'ARS' });
  assert.equal(await codeOf(app.accounts.update(other.id, { name: 'BANCO NACIÓN' })), 'DUPLICATE');
  assert.equal((await app.accounts.update(bank.id, { name: 'Banco Nación' })).name, 'Banco Nación');
});

test('an account with history is archived, not deleted', async () => {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const wallet = await app.accounts.create({ name: 'MercadoPago', type: 'wallet', currency: 'ARS' });
  const empty = await app.accounts.create({ name: 'Sin uso', type: 'cash', currency: 'ARS' });
  await app.transactions.create({ ...expense(bank.id), type: 'transfer', toAccountId: wallet.id });

  assert.equal(await codeOf(app.accounts.remove(bank.id)), 'IN_USE');
  assert.equal(await codeOf(app.accounts.remove(wallet.id)), 'IN_USE'); // destination of a transfer
  await app.accounts.remove(empty.id);
  assert.equal((await app.accounts.list()).length, 2);

  await app.accounts.update(bank.id, { archived: true });
  assert.equal(await codeOf(app.transactions.create(expense(bank.id))), 'VALIDATION');
});

test('deleting a tag takes it off its transactions', async () => {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const trip = await app.tags.create({ name: 'Vacaciones' });
  const home = await app.tags.create({ name: 'Casa' });
  assert.equal(await codeOf(app.tags.create({ name: ' vacaciones' })), 'DUPLICATE');

  const created = await app.transactions.create(expense(bank.id, [trip.id, home.id]));
  await app.tags.remove(trip.id);
  assert.deepEqual((await app.transactions.get(created.id)).tagIds, [home.id]);
  assert.deepEqual(
    (await app.tags.list()).map((tag) => tag.name),
    ['Casa'],
  );
});

test('the monthly summary counts by payment date and leaves transfers and the trash out', async () => {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const card = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  const dollars = await app.accounts.create({ name: 'Caja USD', type: 'cash', currency: 'USD' });

  await app.transactions.create({ ...expense(bank.id), type: 'income', amountCents: 100000 });
  await app.transactions.create({ ...expense(bank.id), amountCents: 30000 });
  await app.transactions.create({ ...expense(card.id), amountCents: 50000, paymentDate: '2026-11-10' });
  await app.transactions.create({
    ...expense(bank.id),
    type: 'transfer',
    toAccountId: card.id,
    amountCents: 99999,
  });
  await app.transactions.create({ ...expense(dollars.id), currency: 'USD', amountCents: 2000 });
  const trashed = await app.transactions.create({ ...expense(bank.id), amountCents: 77777 });
  await app.transactions.remove(trashed.id);

  assert.deepEqual((await app.transactions.summary('2026-10')).totals, [
    { currency: 'ARS', incomeCents: 100000, expenseCents: 30000, balanceCents: 70000 },
    { currency: 'USD', incomeCents: 0, expenseCents: 2000, balanceCents: -2000 },
  ]);
  // The card purchase belongs to the month it is paid in.
  assert.deepEqual((await app.transactions.summary('2026-11')).totals, [
    { currency: 'ARS', incomeCents: 0, expenseCents: 50000, balanceCents: -50000 },
  ]);
});

test('the trash is emptied after the retention period', async () => {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const created = await app.transactions.create(expense(bank.id));
  await app.transactions.remove(created.id);
  assert.equal(await app.transactions.purgeTrash(), 0);
  const inFortyDays = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  assert.equal(await app.transactions.purgeTrash(inFortyDays), 1);
  assert.equal(app.store.transactions.length, 0);
});
