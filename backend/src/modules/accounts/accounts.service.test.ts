import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundError } from '../../core/errors/errors';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

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
  original: null,
  refund: false,
  items: [],
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

test('only what is in the trash can be deleted for good, one by one or all at once', async () => {
  const app = createMemoryBackend();
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const kept = await app.transactions.create(expense(bank.id));
  const first = await app.transactions.create(expense(bank.id));
  const second = await app.transactions.create(expense(bank.id));

  await assert.rejects(app.transactions.removeForever(kept.id), NotFoundError);
  await app.transactions.remove(first.id);
  await app.transactions.remove(second.id);
  await app.transactions.removeForever(first.id);
  await assert.rejects(app.transactions.removeForever(first.id), NotFoundError);
  await assert.rejects(app.transactions.restore(first.id), NotFoundError);

  assert.equal(await app.transactions.emptyTrash(), 1);
  assert.deepEqual(
    app.store.transactions.map((transaction) => transaction.id),
    [kept.id],
  );
});

test('the reference exchange rate is only offered between two different, known currencies', async () => {
  const app = createMemoryBackend();
  assert.equal((await app.exchangeRates.reference('BRL', 'ARS'))?.rate, 300);
  assert.equal(await app.exchangeRates.reference('ARS', 'ARS'), null);
  assert.equal(await app.exchangeRates.reference('XXX', 'ARS'), null);
});

test('a card is tied to an existing bank and brand of the right kind', async () => {
  const app = createMemoryBackend();
  const galicia = await app.institutions.create({ name: 'Galicia', kind: 'bank' });
  const visa = await app.institutions.create({ name: 'Visa', kind: 'network' });

  const card = await app.accounts.create({
    name: 'Visa Galicia',
    type: 'credit_card',
    currency: 'ARS',
    bankId: galicia.id,
    networkId: visa.id,
  });
  assert.equal(card.bankId, galicia.id);
  assert.equal(card.networkId, visa.id);

  // A brand where a bank goes, a brand on something that is not a card, or one that does not exist.
  const base = { type: 'credit_card' as const, currency: 'USD' as const };
  assert.equal(await codeOf(app.accounts.create({ ...base, name: 'A', bankId: visa.id })), 'VALIDATION');
  assert.equal(
    await codeOf(app.accounts.create({ name: 'B', type: 'bank', currency: 'ARS', networkId: visa.id })),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(app.accounts.create({ ...base, name: 'C', networkId: 'f'.repeat(24) })),
    'VALIDATION',
  );

  // An archived one cannot be chosen anew, but stays on the account that has it.
  await app.institutions.update(galicia.id, { archived: true });
  assert.equal(await codeOf(app.accounts.create({ ...base, name: 'D', bankId: galicia.id })), 'VALIDATION');
  assert.equal((await app.accounts.update(card.id, { name: 'Visa Galicia ARS' })).bankId, galicia.id);
  assert.equal((await app.accounts.update(card.id, { bankId: null })).bankId, null);
});

test('banks and brands: unique per kind, and one in use is archived, not deleted', async () => {
  const app = createMemoryBackend();
  const bank = await app.institutions.create({ name: 'Naranja X', kind: 'bank' });
  // The same name as a card brand is a different thing.
  await app.institutions.create({ name: 'Naranja', kind: 'network' });
  assert.equal(await codeOf(app.institutions.create({ name: ' naranja x ', kind: 'bank' })), 'DUPLICATE');

  await app.accounts.create({ name: 'Cuenta', type: 'bank', currency: 'ARS', bankId: bank.id });
  assert.equal(await codeOf(app.institutions.remove(bank.id)), 'IN_USE');
  assert.equal((await app.institutions.update(bank.id, { archived: true })).archived, true);

  const unused = await app.institutions.create({ name: 'Ualá', kind: 'bank' });
  await app.institutions.remove(unused.id);
  assert.equal(await codeOf(app.institutions.get(unused.id)), 'NOT_FOUND');
});
