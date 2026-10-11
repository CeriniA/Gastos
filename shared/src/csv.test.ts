import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectDelimiter, parseCsv, toCsv } from './csv';

test('parseCsv handles quotes, embedded delimiters, line breaks and BOM', () => {
  const text = '\uFEFFFecha;Nota\r\n2026-10-05;"dice ""hola""; y sigue"\r\n2026-10-06;"dos\nlineas"\r\n\r\n';
  assert.deepEqual(parseCsv(text), [
    ['Fecha', 'Nota'],
    ['2026-10-05', 'dice "hola"; y sigue'],
    ['2026-10-06', 'dos\nlineas'],
  ]);
});

test('detectDelimiter picks comma, semicolon or tab from the header', () => {
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(detectDelimiter('a;b;c'), ';');
  assert.equal(detectDelimiter('a\tb\tc'), '\t');
});

test('toCsv output parses back to the same rows', () => {
  const rows = [
    ['Fecha', 'Monto', 'Nota'],
    ['2026-10-05', '15400,50', 'con ; punto y coma y "comillas"'],
    ['2026-10-06', '10,00', ''],
  ];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});
