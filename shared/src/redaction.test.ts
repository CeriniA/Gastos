import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REDACTION_MARK } from './constants';
import { hideWords, redactPersonalData } from './redaction';

const M = REDACTION_MARK;

test('hides card and account numbers, masked or not, and keeps amounts and dates', () => {
  const { text, hidden } = redactPersonalData(
    [
      'Tarjeta 4509 1234 5678 9012',
      'Tarjeta XXXX XXXX XXXX 1234',
      'CBU 0170099220000067797370',
      '15/10/26 MERCADOLIBRE C.03/06 000123 12.345,67',
      'Cupón 4512',
    ].join('\n'),
  );
  assert.equal(
    text,
    [
      `Tarjeta ${M}`,
      `Tarjeta ${M}`,
      `CBU ${M}`,
      '15/10/26 MERCADOLIBRE C.03/06 000123 12.345,67',
      'Cupón 4512',
    ].join('\n'),
  );
  assert.equal(hidden, 3);
});

test('hides a ten-digit phone and a tax id written with dots, and keeps amounts', () => {
  const { text, hidden } = redactPersonalData(
    ['Llamar al 11 5555-5555', 'CUIT 20.12345678.9 ok', 'Total 1.234,56'].join('\n'),
  );
  assert.equal(hidden, 2);
  assert.ok(!text.includes('5555-5555'));
  assert.ok(!text.includes('12345678'));
  assert.ok(text.includes('1.234,56'));
});

test('a row of asterisks or a long word is not a card number', () => {
  const line = '************************ TOTAL CONSUMOS DEL MES';
  assert.deepEqual(redactPersonalData(line), { text: line, hidden: 0 });
});

test('hides tax ids, e-mails and whatever follows a personal label', () => {
  const { text, hidden } = redactPersonalData(
    [
      'Titular: JUAN PEREZ',
      'Domicilio: Av. Siempreviva 742, CABA',
      'DNI 30.123.456',
      'CUIT 20-30123456-7',
      'Nro. de cuenta 123456/7',
      'Avisos a juan.perez@mail.com',
      'Saldo cuenta 12.345,67',
    ].join('\n'),
  );
  assert.equal(
    text,
    [
      `Titular: ${M}`,
      `Domicilio: ${M}`,
      `DNI ${M}`,
      `CUIT ${M}`,
      `Nro. de cuenta ${M}`,
      `Avisos a ${M}`,
      'Saldo cuenta 12.345,67',
    ].join('\n'),
  );
  assert.equal(hidden, 6);
});

test("hides the user's own words ignoring case and accents", () => {
  const { text, hidden } = hideWords('JUAN PEREZ\nSr. Juan Pérez\nCalle Belgrano 123', [
    'Pérez',
    ' juan ',
    'de',
    'Belgrano 123',
  ]);
  assert.equal(text, `${M} ${M}\nSr. ${M} ${M}\nCalle ${M}`);
  assert.equal(hidden, 5);
});
