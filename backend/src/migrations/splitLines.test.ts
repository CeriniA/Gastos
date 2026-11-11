import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitsToLines } from './splitLines';

test('each part becomes a line with its category, and the transaction takes the largest part', () => {
  const result = splitsToLines(
    [
      { categoryId: 'food', amountCents: 70000 },
      { categoryId: 'pharmacy', amountCents: 30000 },
    ],
    [],
  );
  assert.equal(result.categoryId, 'food');
  assert.deepEqual(
    result.items.map((line) => [line.categoryId, line.amountCents]),
    [
      ['food', 70000],
      ['pharmacy', 30000],
    ],
  );
  assert.equal(
    result.items.reduce((sum, line) => sum + line.amountCents, 0),
    100000,
  );
});

test('a tie goes to the first part, and lines the transaction already had stop pointing at lists', () => {
  const result = splitsToLines(
    [
      { categoryId: 'a', amountCents: 500 },
      { categoryId: 'b', amountCents: 500 },
    ],
    [{ name: 'Leche', amountCents: 300, productId: 'milk', categoryId: null }],
  );
  assert.equal(result.categoryId, 'a');
  assert.deepEqual(result.items[0], { name: 'Leche', amountCents: 300, productId: null, categoryId: null });
  assert.equal(result.items.length, 3);
});
