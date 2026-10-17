import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { REDACTION_MARK, type ExtractionResult, type TransactionCreate } from '@gastos/shared';
import { ValidationError } from '../../core/errors/errors';
import { createMemoryBackend } from '../../testing/memory';
import { decodeText, rowsToText, statementFileType } from './statementFile';

/** Statements of any account (a bank, MercadoPago, an app), as PDF, Excel or CSV. */

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const wallet = await app.accounts.create({ name: 'MercadoPago', type: 'wallet', currency: 'ARS' });
  const bank = await app.accounts.create({ name: 'Galicia', type: 'bank', currency: 'ARS' });
  return { app, wallet, bank };
}

async function messageOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof ValidationError);
    return (error.details as { issues: { message: string }[] }).issues[0]!.message;
  }
  assert.fail('expected the preview to be refused');
}

async function excel(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Movimientos');
  for (const row of rows) sheet.addRow(row);
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

test('a file is told by its first bytes: PDF, Excel, an old Excel, text, or none', () => {
  assert.equal(statementFileType(Buffer.from('%PDF-1.7 …')), 'pdf');
  assert.equal(statementFileType(Buffer.from('PK\u0003\u0004 zip')), 'xlsx');
  assert.equal(statementFileType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2])), 'old_excel');
  assert.equal(statementFileType(Buffer.from('Fecha;Detalle;Monto\n')), 'csv');
  assert.equal(statementFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0])), null);
  // Excel on Windows saves CSV in Latin-1: "Débito" still reads as "Débito".
  assert.equal(decodeText(Buffer.from('Débito', 'latin1')), 'Débito');
  assert.equal(decodeText(Buffer.from('\uFEFFDébito', 'utf8')), 'Débito');
  assert.equal(
    rowsToText([{ cells: [new Date('2026-10-02T00:00:00Z'), 'Pago Edesur', -30000] }]),
    '2026-10-02 | Pago Edesur | -30000',
  );
});

test('a CSV or an Excel export becomes text the user reads, with personal data hidden', async () => {
  const { app } = await setup();
  const csv = Buffer.from(
    'Fecha;Detalle;Monto\n02/10/2026;Transferencia a Edesur;-30.000,00\nCVU: 0000003100012345678901\n',
  );
  const fromCsv = await app.documents.previewStatement(csv, undefined);
  assert.equal(fromCsv.fileType, 'csv');
  assert.match(fromCsv.text, /Transferencia a Edesur/);
  assert.ok(fromCsv.text.includes(`CVU: ${REDACTION_MARK}`));
  assert.doesNotMatch(fromCsv.text, /0000003100012345678901/);

  const xlsx = await excel([
    ['Fecha', 'Detalle', 'Monto'],
    [new Date('2026-10-03T00:00:00Z'), 'Rendimientos', 15.2],
    ['Alias:', 'juan.perez.mp'],
  ]);
  const fromExcel = await app.documents.previewStatement(xlsx, undefined);
  assert.equal(fromExcel.fileType, 'xlsx');
  assert.match(fromExcel.text, /2026-10-03 \| Rendimientos \| 15\.2/);
  assert.doesNotMatch(fromExcel.text, /juan\.perez\.mp/);
  // Nothing is stored and nothing goes to the AI until the user sends it.
  assert.equal(app.store.documents.length, 0);
  assert.equal(app.ai.calls.length, 0);
});

test('an old Excel file, a broken one or an empty one says what to do', async () => {
  const { app } = await setup();
  assert.match(
    await messageOf(app.documents.previewStatement(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1]), undefined)),
    /\.xls/,
  );
  assert.equal(
    await messageOf(app.documents.previewStatement(Buffer.from('PK\u0003\u0004 not a workbook'), undefined)),
    'The spreadsheet could not be read',
  );
  assert.equal(
    await messageOf(app.documents.previewStatement(Buffer.from('1;2;3\n'), undefined)),
    'The file has no text',
  );
});

test("an account's statement is read as one and its transfers keep their direction", async () => {
  const { app, wallet, bank } = await setup();
  const reading: ExtractionResult = {
    documentKind: 'account_statement',
    statement: {
      closingDate: null,
      dueDate: null,
      nextClosingDate: null,
      nextDueDate: null,
      totalCents: null,
      minimumPaymentCents: null,
      currency: 'ARS',
      fromDate: '2026-10-01',
      toDate: '2026-10-09',
      openingBalanceCents: 50000,
      closingBalanceCents: 120000,
    },
    warnings: [],
    transactions: [
      {
        type: 'transfer',
        incoming: true,
        refund: false,
        financialCharge: false,
        date: '2026-10-02',
        amountCents: 100000,
        currency: 'ARS',
        merchant: 'Galicia',
        description: 'Ingreso de dinero',
        suggestedCategoryId: null,
        installment: null,
        items: [],
        uncertainFields: [],
      },
    ],
  };
  app.ai.result = reading;
  const uploaded = await app.documents.uploadStatement({
    kind: 'account_statement',
    text: 'MOVIMIENTOS MERCADOPAGO\n02/10 Ingreso de dinero 1.000,00',
    fileName: 'movimientos.csv',
    accountId: wallet.id,
  });
  await app.documents.processQueue();
  assert.equal(app.ai.calls[0]?.kind, 'account_statement');
  const ready = await app.documents.get(uploaded.id);
  assert.equal(ready.kind, 'account_statement');
  assert.equal(ready.extraction?.transactions[0]?.incoming, true);
  assert.equal(ready.extraction?.statement?.closingBalanceCents, 120000);

  // Confirmed as the screen sends it: from the bank, into the wallet.
  await app.documents.confirm(uploaded.id, {
    transactions: [
      {
        transaction: {
          type: 'transfer',
          refund: false,
          date: '2026-10-02',
          amountCents: 100000,
          currency: 'ARS',
          accountId: bank.id,
          categoryId: null,
          description: 'Ingreso de dinero',
          note: '',
          tagIds: [],
          splits: [],
          toAccountId: wallet.id,
          toAmountCents: null,
          paymentDate: null,
          original: null,
          items: [],
        },
        installment: null,
        continuePlan: false,
      },
    ],
    rules: [],
    cardPeriods: [],
  });
  assert.equal((await app.accounts.balance(wallet.id)).balanceCents, 100000);
  assert.equal((await app.accounts.balance(bank.id)).balanceCents, -100000);
});

test('a balance is the opening balance plus every confirmed movement since its day', async () => {
  const { app, wallet, bank } = await setup();
  const usd = await app.accounts.create({ name: 'Dólares', type: 'cash', currency: 'USD' });
  const base: TransactionCreate = {
    type: 'expense',
    date: '2026-10-01',
    amountCents: 1,
    refund: false,
    currency: 'ARS',
    accountId: wallet.id,
    categoryId: null,
    description: '',
    note: '',
    tagIds: [],
    splits: [],
    toAccountId: null,
    toAmountCents: null,
    paymentDate: null,
    original: null,
    items: [],
  };
  const add = (changes: Partial<TransactionCreate>) => app.transactions.create({ ...base, ...changes });
  await add({ type: 'income', date: '2026-09-20', amountCents: 999999 }); // before the opening day
  await app.accounts.update(wallet.id, { openingBalance: { amountCents: 50000, date: '2026-10-01' } });
  await add({ type: 'income', date: '2026-10-01', amountCents: 20000 });
  await add({ type: 'expense', date: '2026-10-02', amountCents: 7000 });
  await add({ type: 'expense', date: '2026-10-03', amountCents: 1000, refund: true });
  await add({ type: 'transfer', date: '2026-10-04', amountCents: 10000, toAccountId: bank.id });
  await add({
    type: 'transfer',
    date: '2026-10-05',
    amountCents: 12000,
    toAccountId: usd.id,
    toAmountCents: 10,
  });
  const trashed = await add({ type: 'expense', date: '2026-10-06', amountCents: 5000 });
  await app.transactions.remove(trashed.id);

  // 50000 + 20000 - 7000 + 1000 - 10000 - 12000
  assert.equal((await app.accounts.balance(wallet.id)).balanceCents, 42000);
  // On an earlier day, only what happened up to it.
  assert.equal((await app.accounts.balance(wallet.id, '2026-10-02')).balanceCents, 63000);
  const balances = await app.accounts.balances();
  assert.deepEqual(
    balances
      .filter((balance) => [bank.id, usd.id].includes(balance.accountId))
      .map((balance) => [balance.currency, balance.balanceCents]),
    [
      ['ARS', 10000],
      ['USD', 10],
    ],
  );
});
