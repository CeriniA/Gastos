import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transactionCreateSchema, transactionUpdateSchema } from './transaction';

const account = 'a'.repeat(24);
const other = 'b'.repeat(24);
const category = 'c'.repeat(24);
const base = {
  type: 'expense',
  date: '2026-10-05',
  amountCents: 150000,
  currency: 'ARS',
  accountId: account,
};

test('a minimal expense gets its defaults', () => {
  const parsed = transactionCreateSchema.parse(base);
  assert.equal(parsed.categoryId, null);
  assert.deepEqual(parsed.tagIds, []);
  assert.equal(parsed.paymentDate, null);
});

test('amounts must be positive integer cents', () => {
  assert.equal(transactionCreateSchema.safeParse({ ...base, amountCents: 0 }).success, false);
  assert.equal(transactionCreateSchema.safeParse({ ...base, amountCents: 10.5 }).success, false);
  assert.equal(transactionCreateSchema.safeParse({ ...base, amountCents: -100 }).success, false);
});

test('transfers need a different destination and no category', () => {
  const transfer = { ...base, type: 'transfer' };
  assert.equal(transactionCreateSchema.safeParse(transfer).success, false);
  assert.equal(transactionCreateSchema.safeParse({ ...transfer, toAccountId: account }).success, false);
  assert.equal(
    transactionCreateSchema.safeParse({ ...transfer, toAccountId: other, categoryId: category }).success,
    false,
  );
  assert.equal(transactionCreateSchema.safeParse({ ...transfer, toAccountId: other }).success, true);
  assert.equal(transactionCreateSchema.safeParse({ ...base, toAccountId: other }).success, false);
});

test('splits must add up to the total and replace the single category', () => {
  const splits = [
    { categoryId: category, amountCents: 100000 },
    { categoryId: other, amountCents: 50000 },
  ];
  assert.equal(transactionCreateSchema.safeParse({ ...base, splits }).success, true);
  assert.equal(transactionCreateSchema.safeParse({ ...base, splits, categoryId: category }).success, false);
  assert.equal(
    transactionCreateSchema.safeParse({ ...base, splits: [{ categoryId: category, amountCents: 1 }] })
      .success,
    false,
  );
});

test('a partial update does not invent defaults for omitted fields', () => {
  assert.deepEqual(transactionUpdateSchema.parse({ note: 'x' }), { note: 'x' });
  assert.equal(transactionUpdateSchema.safeParse({}).success, false);
});
