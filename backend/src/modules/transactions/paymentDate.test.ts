import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePaymentDate } from './paymentDate';

const base = { date: '2026-10-28', requested: null, periodDueDate: null };

test('non-card accounts are paid the day of the transaction, whatever is requested', () => {
  for (const accountType of ['cash', 'bank', 'wallet'] as const) {
    assert.equal(resolvePaymentDate({ ...base, accountType, requested: '2026-12-10' }), '2026-10-28');
  }
});

test('credit cards: statement due date, then the requested date, then the purchase date', () => {
  const card = { ...base, accountType: 'credit_card' as const };
  assert.equal(resolvePaymentDate(card), '2026-10-28');
  assert.equal(resolvePaymentDate({ ...card, requested: '2026-12-10' }), '2026-12-10');
  assert.equal(
    resolvePaymentDate({ ...card, requested: '2026-12-10', periodDueDate: '2026-12-05' }),
    '2026-12-05',
  );
});
