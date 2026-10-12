import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IMPORT_COLUMNS, toCsv, type ImportPreview, type ImportRow } from '@gastos/shared';
import { ValidationError } from '../../core/errors/errors';
import { createMemoryBackend } from '../../testing/memory';

/**
 * Import and export, end to end, over the in-memory backend and CSV files.
 * (Excel files go through the same service; only the file reader differs.)
 */

const HEADERS = IMPORT_COLUMNS.map((column) => column.header);

function csv(...rows: Partial<Record<(typeof IMPORT_COLUMNS)[number]['header'], string>>[]): Buffer {
  const lines = rows.map((row) => HEADERS.map((header) => row[header as keyof typeof row] ?? ''));
  return Buffer.from(toCsv([HEADERS, ...lines]), 'utf8');
}

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const card = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  const dollars = await app.accounts.create({ name: 'Caja USD', type: 'cash', currency: 'USD' });
  const home = await app.categories.create({ name: 'Vivienda', kind: 'expense', parentId: null });
  return { app, bank, card, dollars, home };
}

const importable = (preview: ImportPreview, includeDuplicates = false): ImportRow[] =>
  preview.rows.flatMap((entry) =>
    entry.row && entry.issues.length === 0 && (includeDuplicates || !entry.duplicate) ? [entry.row] : [],
  );

const issuesOf = (preview: ImportPreview, line: number) =>
  preview.rows.find((entry) => entry.line === line)?.issues.map((issue) => `${issue.column}:${issue.code}`) ??
  [];

const FILE = () =>
  csv(
    {
      Fecha: '05/10/2026',
      Tipo: 'egreso',
      Monto: '15.400,50',
      Moneda: 'ARS',
      Cuenta: 'banco',
      Categoría: 'Vivienda > Servicios > Luz',
      Descripción: 'Edesur',
      Etiquetas: 'casa, fijo',
    },
    {
      Fecha: '2026-10-06',
      Tipo: 'egreso',
      Monto: '90000',
      Moneda: 'ARS',
      Cuenta: 'Visa',
      Categoría: 'Compras',
      Descripción: 'Zapatillas',
      Cuota: '1/3',
      'Fecha de pago': '2026-11-10',
    },
    {
      Fecha: '2026-10-01',
      Tipo: 'ingreso',
      Monto: '1000000',
      Moneda: 'ARS',
      Cuenta: 'Banco',
      Categoría: 'Sueldo',
    },
    {
      Fecha: '2026-10-02',
      Tipo: 'transferencia',
      Monto: '150000',
      Moneda: 'ARS',
      Cuenta: 'Banco',
      'Cuenta destino': 'Caja USD',
      'Monto destino': '100',
    },
  );

test('the preview reports what would be imported and writes nothing', async () => {
  const { app } = await setup();
  const preview = await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' });

  assert.equal(preview.totalRows, 4);
  assert.equal(preview.validRows, 4);
  assert.equal(preview.invalidRows, 0);
  assert.equal(preview.duplicateRows, 0);
  assert.deepEqual(preview.missingHeaders, []);
  assert.deepEqual(preview.newCategories, [
    { kind: 'expense', path: ['Compras'] },
    { kind: 'income', path: ['Sueldo'] },
    { kind: 'expense', path: ['Vivienda', 'Servicios', 'Luz'] },
  ]);
  assert.deepEqual(preview.unknownAccounts, []);
  assert.deepEqual(preview.newTags, ['casa', 'fijo']);
  assert.deepEqual(
    preview.rows.map((entry) => entry.line),
    [2, 3, 4, 5],
  );
  assert.equal(app.store.transactions.length, 0);
  assert.equal(app.store.tags.length, 0);
});

test('a confirmed import creates transactions, categories and tags together', async () => {
  const { app, bank, card, dollars, home } = await setup();
  const preview = await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' });
  const result = await app.spreadsheet.commit({ rows: importable(preview), createMissing: true });

  // "Vivienda" already existed, so only its two missing levels are created.
  assert.deepEqual(result, { imported: 4, createdCategories: 4, createdTags: 2 });

  const categories = await app.categories.list();
  const power = categories.find((category) => category.name === 'Luz');
  const services = categories.find((category) => category.name === 'Servicios');
  assert.equal(services?.parentId, home.id);
  assert.equal(power?.parentId, services?.id);
  assert.equal(categories.find((category) => category.name === 'Sueldo')?.kind, 'income');

  const all = (await app.transactions.list({ page: 1, pageSize: 50 })).items;
  const bill = all.find((transaction) => transaction.description === 'Edesur');
  assert.equal(bill?.amountCents, 1540050);
  assert.equal(bill?.accountId, bank.id);
  assert.equal(bill?.categoryId, power?.id);
  assert.equal(bill?.source, 'import');
  assert.equal(bill?.tagIds.length, 2);

  const shoes = all.find((transaction) => transaction.description === 'Zapatillas');
  assert.equal(shoes?.accountId, card.id);
  assert.equal(shoes?.paymentDate, '2026-11-10');
  assert.deepEqual(shoes?.installment, { planId: null, number: 1, total: 3 });

  const transfer = all.find((transaction) => transaction.type === 'transfer');
  assert.equal(transfer?.toAccountId, dollars.id);
  assert.equal(transfer?.toAmountCents, 10000);
  assert.equal(transfer?.categoryId, null);
});

test('importing the same file again flags every row as a duplicate', async () => {
  const { app } = await setup();
  const first = await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' });
  await app.spreadsheet.commit({ rows: importable(first), createMissing: true });

  const second = await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' });
  assert.equal(second.duplicateRows, 4);
  assert.deepEqual(second.newCategories, []);
  assert.deepEqual(second.newTags, []);
  assert.equal(importable(second).length, 0);
  assert.equal(importable(second, true).length, 4);
});

test('every problem is tied to its row and column', async () => {
  const { app, bank } = await setup();
  await app.accounts.update(bank.id, { archived: true });
  const file = csv(
    { Fecha: '2026-10-05', Tipo: 'egreso', Monto: '100', Moneda: 'ARS', Cuenta: 'Galicia' },
    { Fecha: '2026-10-05', Tipo: 'egreso', Monto: '100', Moneda: 'USD', Cuenta: 'Visa' },
    { Fecha: '2026-12-01', Tipo: 'egreso', Monto: '100', Moneda: 'ARS', Cuenta: 'Visa' },
    { Fecha: '2026-10-05', Tipo: 'egreso', Monto: '100', Moneda: 'ARS', Cuenta: 'Banco' },
    {
      Fecha: '2026-10-05',
      Tipo: 'transferencia',
      Monto: '100',
      Moneda: 'ARS',
      Cuenta: 'Visa',
      'Cuenta destino': 'Caja USD',
    },
    {
      Fecha: '2026-10-05',
      Tipo: 'transferencia',
      Monto: '100',
      Moneda: 'ARS',
      Cuenta: 'Visa',
      'Cuenta destino': 'Nadie',
    },
    { Fecha: 'ayer', Tipo: 'egreso', Monto: 'mucho', Moneda: 'ARS', Cuenta: 'Visa' },
    { Fecha: '2026-10-05', Tipo: 'egreso', Monto: '100', Moneda: 'ARS', Cuenta: 'Visa' },
  );
  const preview = await app.spreadsheet.preview({ content: file, fileName: 'errores.csv' });

  assert.deepEqual(issuesOf(preview, 2), ['account:unknown_account']);
  assert.deepEqual(issuesOf(preview, 3), ['currency:currency_mismatch']);
  assert.deepEqual(issuesOf(preview, 4), ['date:future_date']);
  assert.deepEqual(issuesOf(preview, 5), ['account:archived_account']);
  assert.deepEqual(issuesOf(preview, 6), ['toAmount:destination_amount_required']);
  assert.deepEqual(issuesOf(preview, 7), ['toAccount:unknown_account']);
  assert.deepEqual(issuesOf(preview, 8).sort(), ['amount:invalid_amount', 'date:invalid_date']);
  assert.deepEqual(issuesOf(preview, 9), []);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.invalidRows, 7);
  assert.deepEqual(preview.unknownAccounts, ['Galicia', 'Nadie']);
});

test('rows pointed at an existing account or category are checked again, and nothing is written', async () => {
  const { app, bank, home } = await setup();
  const file = csv(
    {
      Fecha: '2026-10-05',
      Tipo: 'egreso',
      Monto: '100',
      Moneda: 'ARS',
      Cuenta: 'Galicia',
      Categoría: 'Casa',
    },
    { Fecha: 'ayer', Tipo: 'egreso', Monto: '100', Moneda: 'ARS', Cuenta: 'Galicia' },
  );
  const preview = await app.spreadsheet.preview({ content: file, fileName: 'banco.csv' });
  assert.deepEqual(preview.unknownAccounts, ['Galicia']);
  assert.deepEqual(preview.newCategories, [{ kind: 'expense', path: ['Casa'] }]);
  assert.equal(preview.validRows, 0);

  // The user says "Galicia" is the account "Banco" and "Casa" is the category "Vivienda".
  const adjusted = preview.rows.flatMap((entry) =>
    entry.row
      ? [{ line: entry.line, row: { ...entry.row, account: 'Banco', categoryPath: ['Vivienda'] } }]
      : [],
  );
  const reviewed = await app.spreadsheet.review({ rows: adjusted });
  assert.deepEqual(reviewed.unknownAccounts, []);
  assert.deepEqual(reviewed.newCategories, []);
  assert.equal(reviewed.validRows, 1);
  assert.deepEqual(issuesOf(reviewed, 2), []);
  assert.equal(app.store.transactions.length, 0);

  const result = await app.spreadsheet.commit({ rows: importable(reviewed), createMissing: false });
  assert.deepEqual(result, { imported: 1, createdCategories: 0, createdTags: 0 });
  const [stored] = app.store.transactions;
  assert.equal(stored?.accountId, bank.id);
  assert.equal(stored?.categoryId, home.id);
});

test('a file without the required columns is reported before any row is read', async () => {
  const { app } = await setup();
  const file = Buffer.from('Fecha;Importe;Saldo\n2026-10-05;100;5000\n', 'utf8');
  const preview = await app.spreadsheet.preview({ content: file, fileName: 'banco.csv' });
  assert.deepEqual(preview.missingHeaders, ['Tipo', 'Moneda', 'Cuenta']);
  assert.deepEqual(preview.unknownHeaders, ['Saldo']);
  assert.deepEqual(preview.rows, []);
  await assert.rejects(
    app.spreadsheet.preview({ content: Buffer.from(''), fileName: 'vacio.csv' }),
    ValidationError,
  );
});

test('nothing is created unless the user agrees to new categories and tags', async () => {
  const { app } = await setup();
  const preview = await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' });
  await assert.rejects(
    app.spreadsheet.commit({ rows: importable(preview), createMissing: false }),
    ValidationError,
  );
  assert.equal(app.store.transactions.length, 0);
  assert.equal(app.store.categories.length, 1);
  assert.equal(app.store.tags.length, 0);
});

test('the commit re-checks rows and is all or nothing', async () => {
  const { app } = await setup();
  const rows = importable(await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' }));

  // A row tampered with after the preview is rejected and nothing is stored.
  const tampered = rows.map((row, index) => (index === 3 ? { ...row, account: 'Galicia' } : row));
  await assert.rejects(app.spreadsheet.commit({ rows: tampered, createMissing: true }), ValidationError);
  assert.equal(app.store.transactions.length, 0);
  assert.equal(app.store.categories.length, 1);

  // A write that fails after categories and tags were created rolls those back too.
  app.faults.insertTransactions = true;
  await assert.rejects(app.spreadsheet.commit({ rows, createMissing: true }), /simulated write failure/);
  assert.equal(app.store.transactions.length, 0);
  assert.equal(app.store.categories.length, 1);
  assert.equal(app.store.tags.length, 0);

  app.faults.insertTransactions = false;
  assert.equal((await app.spreadsheet.commit({ rows, createMissing: true })).imported, 4);
});

test('an export can be imported into an empty app and comes out the same', async () => {
  const { app } = await setup();
  const preview = await app.spreadsheet.preview({ content: FILE(), fileName: 'movimientos.csv' });
  await app.spreadsheet.commit({ rows: importable(preview), createMissing: true });
  const exported = await app.spreadsheet.exportTransactions({ format: 'csv' });
  assert.equal(exported.fileName, 'gastos-movimientos-2026-10-10.csv');

  const { app: fresh } = await setup();
  const again = await fresh.spreadsheet.preview({ content: exported.content, fileName: exported.fileName });
  assert.equal(again.validRows, 4);
  await fresh.spreadsheet.commit({ rows: importable(again), createMissing: true });

  const reexported = await fresh.spreadsheet.exportTransactions({ format: 'csv' });
  assert.equal(reexported.content.toString('utf8'), exported.content.toString('utf8'));
  assert.deepEqual(
    (await fresh.transactions.summary('2026-10')).totals,
    (await app.transactions.summary('2026-10')).totals,
  );
});

test('the export splits a divided transaction into one row per category and honours the date range', async () => {
  const { app, bank, home } = await setup();
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });
  const base = {
    type: 'expense' as const,
    currency: 'ARS' as const,
    accountId: bank.id,
    description: 'Coto',
    note: '',
    tagIds: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    refund: false,
    items: [],
  };
  await app.transactions.create({
    ...base,
    date: '2026-10-05',
    amountCents: 3000,
    categoryId: null,
    splits: [
      { categoryId: food.id, amountCents: 2000 },
      { categoryId: home.id, amountCents: 1000 },
    ],
  });
  await app.transactions.create({
    ...base,
    date: '2026-09-20',
    amountCents: 500,
    categoryId: food.id,
    splits: [],
  });
  const trashed = await app.transactions.create({
    ...base,
    date: '2026-10-06',
    amountCents: 999,
    categoryId: null,
    splits: [],
  });
  await app.transactions.remove(trashed.id);

  const october = await app.spreadsheet.exportTransactions({
    format: 'csv',
    from: '2026-10-01',
    to: '2026-10-31',
  });
  const lines = october.content.toString('utf8').trim().split('\r\n');
  assert.equal(lines.length, 3); // header + two parts
  assert.match(lines[1] ?? '', /2026-10-05;egreso;20,00;ARS;Banco;Supermercado;Coto/);
  assert.match(lines[2] ?? '', /2026-10-05;egreso;10,00;ARS;Banco;Vivienda;Coto/);

  const everything = await app.spreadsheet.exportTransactions({ format: 'csv' });
  assert.equal(everything.content.toString('utf8').trim().split('\r\n').length, 4);
});
