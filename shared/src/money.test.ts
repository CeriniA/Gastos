import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  centsToDecimalString,
  averageCents,
  convertBetween,
  convertCents,
  isNear,
  impliedRate,
  splitInstallments,
  formatRate,
  formatMoney,
  parseAmountToCents,
  parseRate,
  sumCents,
} from './money';

test('parseAmountToCents reads Argentine and international formats', () => {
  assert.equal(parseAmountToCents('15400,50'), 1540050);
  assert.equal(parseAmountToCents('15.400,50'), 1540050);
  assert.equal(parseAmountToCents('15400.50'), 1540050);
  assert.equal(parseAmountToCents('1,234.56'), 123456);
  assert.equal(parseAmountToCents('$ 1.500'), 150000);
  assert.equal(parseAmountToCents('1.234.567'), 123456700);
  assert.equal(parseAmountToCents('0,5'), 50);
  assert.equal(parseAmountToCents('100'), 10000);
  assert.equal(parseAmountToCents('-20,10'), -2010);
  assert.equal(parseAmountToCents(15400.5), 1540050);
});

test('parseAmountToCents avoids floating point drift', () => {
  assert.equal(parseAmountToCents('0,29'), 29);
  assert.equal(parseAmountToCents('1,005'), 100500);
  assert.equal(parseAmountToCents(0.1 + 0.2), 30);
});

test('parseAmountToCents rejects text that is not a number', () => {
  assert.equal(parseAmountToCents(''), null);
  assert.equal(parseAmountToCents('abc'), null);
  assert.equal(parseAmountToCents(Number.NaN), null);
});

test('centsToDecimalString round-trips through the parser', () => {
  for (const cents of [0, 5, 50, 1540050, 100, 99999999]) {
    assert.equal(parseAmountToCents(centsToDecimalString(cents)), cents);
  }
  assert.equal(centsToDecimalString(1540050), '15400,50');
  assert.equal(centsToDecimalString(-5), '-0,05');
});

test('exchange rates keep their decimals and conversion rounds to whole cents', () => {
  assert.equal(parseRate('272,50'), 272.5);
  assert.equal(parseRate(' 272.5 '), 272.5);
  assert.equal(parseRate('280'), 280);
  assert.equal(parseRate('0'), null);
  assert.equal(parseRate('1.272,50'), null);
  assert.equal(parseRate('abc'), null);
  assert.equal(formatRate(302.622281), '302,6223');
  assert.equal(formatRate(272.5), '272,5');
  assert.equal(parseRate(formatRate(302.622281)), 302.6223);
  assert.equal(convertCents(5000, 272.5), 1362500); // R$ 50,00 at 272,50 = $ 13.625,00
  assert.equal(convertCents(1999, 272.33), 544388);
  assert.match(formatMoney(5000, 'BRL'), /50,00/);
});

test('formatMoney and sumCents', () => {
  assert.match(formatMoney(1540050, 'ARS'), /15\.400,50/);
  assert.equal(sumCents([10, 20, 30]), 60);
});

test('impliedRate is the rate that links an amount to its original', () => {
  assert.equal(impliedRate(1362500, 5000), 272.5);
  assert.equal(impliedRate(1500000, 5000), 300);
  // Converting back with it gives the same amount, whatever rounding the user applied.
  assert.equal(convertCents(1999, impliedRate(544400, 1999)), 544400);
});

test('splitInstallments divides in whole cents and gives the leftover to the first', () => {
  assert.deepEqual(splitInstallments(100000, 4), [25000, 25000, 25000, 25000]);
  assert.deepEqual(splitInstallments(100001, 3), [33335, 33333, 33333]);
  assert.equal(
    splitInstallments(987654, 7).reduce((sum, part) => sum + part, 0),
    987654,
  );
});

test('pesos and dollars are turned into each other with a rate of pesos per dollar', () => {
  assert.equal(convertBetween(1000, 'USD', 'ARS', 1250.5), 1250500);
  assert.equal(convertBetween(125050, 'ARS', 'USD', 1250.5), 100);
  assert.equal(convertBetween(999, 'ARS', 'ARS', 1250.5), 999);
});

test('an amount is near another when it is within a share of it', () => {
  assert.equal(isNear(11900, 10000, 0.2), true);
  assert.equal(isNear(12000, 10000, 0.2), true);
  assert.equal(isNear(12001, 10000, 0.2), false);
  assert.equal(isNear(7999, 10000, 0.2), false);
});

test('an average is in whole cents, and zero for nothing', () => {
  assert.equal(averageCents([100, 200, 201]), 167);
  assert.equal(averageCents([]), 0);
});
