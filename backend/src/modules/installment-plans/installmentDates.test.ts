import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closingCovering, installmentDates } from './installmentDates';

test('the closing that covers a purchase is found, or estimated a month at a time', () => {
  const closings = ['2026-10-08', '2026-11-05'];
  assert.equal(closingCovering('2026-10-07', closings), '2026-10-08');
  assert.equal(closingCovering('2026-10-08', closings), '2026-10-08');
  assert.equal(closingCovering('2026-10-09', closings), '2026-11-05');
  // After the last known one, and long before the first.
  assert.equal(closingCovering('2026-12-20', closings), '2027-01-05');
  assert.equal(closingCovering('2026-07-01', closings), '2026-07-08');
  assert.equal(closingCovering('2026-10-07', []), null);
});

test('a purchase the day before a closing still has one installment per statement', () => {
  // Closing on the 8th, then on the 5th: a month after the purchase would be past the next closing.
  assert.deepEqual(installmentDates('2026-10-07', 3, ['2026-10-08', '2026-11-05']), [
    '2026-10-07',
    '2026-10-23',
    '2026-11-23',
  ]);
  // Without closings, a month apart.
  assert.deepEqual(installmentDates('2026-10-07', 3, []), ['2026-10-07', '2026-11-07', '2026-12-07']);
});
