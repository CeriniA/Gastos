import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAliases, findByPrintedText } from './aliases';

test('known texts are trimmed, without blanks, repeats or the item own name', () => {
  assert.deepEqual(cleanAliases('Coto', [' COTO CICSA ', 'coto cicsa', 'COTO', '', '  ']), ['COTO CICSA']);
});

test('a printed text finds the item by name or known text, ignoring case and accents', () => {
  const items = [
    { id: '1', name: 'Café Martínez', aliases: ['CAFE MTZ'] },
    { id: '2', name: 'Coto', aliases: [] },
  ];
  assert.equal(findByPrintedText(items, 'cafe martinez')?.id, '1');
  assert.equal(findByPrintedText(items, 'Cafe Mtz')?.id, '1');
  assert.equal(findByPrintedText(items, 'coto', '2'), undefined);
  assert.equal(findByPrintedText(items, ''), undefined);
});
