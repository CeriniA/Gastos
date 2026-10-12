import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv, toCsv } from './csv';
import {
  IMPORT_COLUMNS,
  categoryPathKey,
  importRowSchema,
  mapHeaders,
  parseImportRecord,
  toExportRecord,
  type ImportRecord,
  type ImportRow,
} from './importFormat';

const valid: ImportRecord = {
  date: '05/10/2026',
  type: 'Egreso',
  amount: '15.400,50',
  currency: 'ars',
  account: 'Visa Banco X',
  category: 'Vivienda > Servicios > Luz',
  description: 'Edesur',
  tags: 'casa, fijo, Casa',
  installment: '3/6',
  paymentDate: '2026-11-10',
};

test('mapHeaders ignores case and accents, and reports what is missing', () => {
  const mapping = mapHeaders(['fecha', 'TIPO', 'Importe', 'Moneda', 'Categoria', 'Saldo']);
  assert.deepEqual(mapping.columns, ['date', 'type', 'amount', 'currency', 'category', null]);
  assert.deepEqual(mapping.missing, ['Cuenta']);
  assert.deepEqual(mapping.unknown, ['Saldo']);
});

test('a complete row is parsed into normalised values', () => {
  const { row, issues } = parseImportRecord(valid);
  assert.deepEqual(issues, []);
  assert.deepEqual(row, {
    date: '2026-10-05',
    type: 'expense',
    amountCents: 1540050,
    currency: 'ARS',
    account: 'Visa Banco X',
    categoryPath: ['Vivienda', 'Servicios', 'Luz'],
    description: 'Edesur',
    tags: ['casa', 'fijo'],
    note: '',
    installment: { number: 3, total: 6 },
    paymentDate: '2026-11-10',
    toAccount: null,
    toAmountCents: null,
  } satisfies ImportRow);
});

test('spreadsheet cells arrive as Date and number', () => {
  const { row } = parseImportRecord({ ...valid, date: new Date(Date.UTC(2026, 9, 5)), amount: 15400.5 });
  assert.equal(row?.date, '2026-10-05');
  assert.equal(row?.amountCents, 1540050);
});

test('every problem in a row is reported, tied to its column', () => {
  const { row, issues } = parseImportRecord({
    date: '31/02/2026',
    type: 'compra',
    amount: '-5',
    currency: 'EUR',
    account: '',
    category: 'A > B > C > D',
    installment: '7/6',
  });
  assert.equal(row, null);
  assert.deepEqual(
    issues.map((issue) => `${issue.column}:${issue.code}`).sort(),
    [
      'account:required',
      'amount:invalid_amount',
      'category:category_too_deep',
      'currency:invalid_currency',
      'date:invalid_date',
      'installment:invalid_installment',
      'type:invalid_type',
    ].sort(),
  );
});

test('transfer rules', () => {
  const transfer: ImportRecord = {
    date: '2026-10-05',
    type: 'transferencia',
    amount: 100,
    currency: 'ARS',
    account: 'Banco',
  };
  assert.deepEqual(parseImportRecord(transfer).issues, [
    { column: 'toAccount', code: 'transfer_needs_destination' },
  ]);
  assert.deepEqual(parseImportRecord({ ...transfer, toAccount: 'banco' }).issues, [
    { column: 'toAccount', code: 'same_account' },
  ]);
  assert.deepEqual(parseImportRecord({ ...transfer, toAccount: 'MercadoPago', category: 'Otros' }).issues, [
    { column: 'category', code: 'transfer_has_category' },
  ]);
  assert.equal(parseImportRecord({ ...transfer, toAccount: 'MercadoPago' }).row?.toAccount, 'MercadoPago');
  assert.deepEqual(parseImportRecord({ ...valid, toAccount: 'MercadoPago' }).issues, [
    { column: 'toAccount', code: 'destination_without_transfer' },
  ]);
});

test('an exported file can be imported back unchanged', () => {
  const original = parseImportRecord(valid).row;
  assert.ok(original);
  const exported = toExportRecord(original);
  const csv = toCsv([
    IMPORT_COLUMNS.map((column) => column.header),
    IMPORT_COLUMNS.map((column) => exported[column.key]),
  ]);

  const [headers, cells] = parseCsv(csv);
  assert.ok(headers && cells);
  const mapping = mapHeaders(headers);
  assert.deepEqual(mapping.missing, []);
  const record: ImportRecord = {};
  mapping.columns.forEach((key, index) => {
    if (key) record[key] = cells[index];
  });
  assert.deepEqual(parseImportRecord(record).row, original);
  assert.equal(importRowSchema.safeParse(original).success, true);
});

test('importRowSchema re-checks rows sent back by the client', () => {
  const row = parseImportRecord(valid).row;
  assert.ok(row);
  assert.equal(importRowSchema.safeParse({ ...row, amountCents: 0 }).success, false);
  assert.equal(importRowSchema.safeParse({ ...row, type: 'transfer' }).success, false);
  assert.equal(importRowSchema.safeParse({ ...row, installment: { number: 9, total: 6 } }).success, false);
});

test('categoryPathKey ignores case, accents and spacing, but not the kind', () => {
  assert.equal(
    categoryPathKey('expense', ['Súper ', 'Verdulería']),
    categoryPathKey('expense', ['super', 'verduleria']),
  );
  assert.notEqual(categoryPathKey('expense', ['Otros']), categoryPathKey('income', ['Otros']));
  assert.notEqual(categoryPathKey('expense', ['A', 'B']), categoryPathKey('expense', ['B']));
});
