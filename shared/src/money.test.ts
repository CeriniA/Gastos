import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  centsToDecimalString,
  convertCents,
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
