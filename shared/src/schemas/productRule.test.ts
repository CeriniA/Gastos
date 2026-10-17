import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionItem } from './transaction';
import { applyProductRule, productCorrections } from './productRule';

const line = (overrides: Partial<TransactionItem>): TransactionItem => ({
  name: 'YERB.PLAY 1000',
  amountCents: 5200,
  product: 'Yerba',
  group: 'pantry',
  quantity: null,
  ...overrides,
});

test('only the lines kept with a different product or group are corrections, once per printed text', () => {
  const read = [
    line({}),
    line({ name: 'LECHE ENT 1L', product: 'Leche entera', group: null }),
    line({ name: 'BOLSA', product: '', group: null }),
  ];
  const kept = [
    line({ amountCents: 9999 }), // same product and group: the amount is not a correction
    line({ name: 'leche ent 1l', product: 'Leche', group: 'dairy' }),
    line({ name: 'LECHE ENT 1L', product: 'Leche', group: 'dairy' }),
    line({ name: 'PAN', product: 'Pan', group: 'bakery' }), // typed by hand: nothing was read for it
  ];
  assert.deepEqual(productCorrections(read, kept), [
    { name: 'LECHE ENT 1L', product: 'Leche', group: 'dairy' },
  ]);
});

test('a rule gives its product and group to the line it matches, whatever its case or accents', () => {
  const rules = new Map([['leche ent 1l', { product: 'Leche', group: 'dairy' as const }]]);
  assert.deepEqual(
    applyProductRule(line({ name: 'Leche Ent 1L', product: 'Leche entera', group: null }), rules),
    {
      ...line({ name: 'Leche Ent 1L' }),
      product: 'Leche',
      group: 'dairy',
    },
  );
  const untouched = line({});
  assert.equal(applyProductRule(untouched, rules), untouched);
});
