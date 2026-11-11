import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_STATEMENT_PAGES,
  MAX_STATEMENT_TEXT_LENGTH,
  REDACTION_MARK,
  type DocumentConfirm,
  type ExtractedTransaction,
  type ExtractionResult,
} from '@gastos/shared';
import { ValidationError } from '../../core/errors/errors';
import { PdfReadError } from '../../providers/pdf/pdfReader';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';
import { dateInstallmentsOnClosing, tidyStatementText } from './statement';

/** Card statements: PDF → text the user approves → AI reading → review with the statement's dates. */

const pdfBytes = Buffer.from('%PDF-1.7 statement bytes');

const line = (overrides: Partial<ExtractedTransaction> = {}): ExtractedTransaction => ({
  type: 'expense',
  refund: false,
  financialCharge: false,
  date: '2026-10-02',
  amountCents: 250000,
  currency: 'ARS',
  merchant: 'Supermercado',
  description: 'Compra',
  suggestedCategoryId: null,
  installment: null,
  items: [],
  uncertainFields: [],
  ...overrides,
});

const statementReading = (...transactions: ExtractedTransaction[]): ExtractionResult => ({
  documentKind: 'card_statement',
  transactions,
  statement: {
    closingDate: '2026-10-08',
    dueDate: '2026-10-20',
    nextClosingDate: '2026-11-05',
    nextDueDate: '2026-11-17',
    totalCents: 400000,
    minimumPaymentCents: 40000,
    currency: 'ARS',
  },
  warnings: [],
});

/** The field a validation error points at. */
async function issuePathOf(work: Promise<unknown>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof ValidationError, `expected a validation error, got ${String(error)}`);
    return (error.details as { issues: { path: string }[] }).issues[0]?.path;
  }
  assert.fail('expected the work to fail');
}

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const visa = await app.accounts.create({ name: 'Visa', type: 'credit_card', currency: 'ARS' });
  const visaUsd = await app.accounts.create({ name: 'Visa USD', type: 'credit_card', currency: 'USD' });
  return { app, visa, visaUsd };
}

function confirmation(accountId: string, overrides: Partial<DocumentConfirm> = {}): DocumentConfirm {
  return {
    transactions: [
      {
        transaction: {
          type: 'expense',
          date: '2026-10-02',
          amountCents: 250000,
          currency: 'ARS',
          accountId,
          categoryId: null,
          description: 'Compra',
          merchantId: null,
          note: '',
          tagIds: [],
          toAccountId: null,
          toAmountCents: null,
          paymentDate: null,
          original: null,
          refund: false,
          items: [],
        },
        installment: null,
        continuePlan: false,
      },
    ],
    rules: [],
    productRules: [],
    cardPeriods: [],
    ...overrides,
  };
}

test('the preview is the tidied text with personal data hidden, and nothing is stored or sent', async () => {
  const { app } = await setup();
  app.pdf.pages = [
    'Titular: JUAN PEREZ   \n\n\n\nTarjeta 4509 1234 5678 9012\n',
    '02/10 SUPERMERCADO 2.500,00',
  ];

  const preview = await app.documents.previewStatement(pdfBytes, 'clave');
  assert.deepEqual(preview, {
    text: `Titular: ${REDACTION_MARK}\n\nTarjeta ${REDACTION_MARK}\n\n02/10 SUPERMERCADO 2.500,00`,
    pages: 2,
    hidden: 2,
    fileType: 'pdf',
  });
  assert.deepEqual(app.pdf.passwords, ['clave']);
  assert.equal(app.store.documents.length, 0);
  assert.equal(app.ai.calls.length, 0);
});

test('a PDF that cannot be previewed says why, on the field to fix', async () => {
  const { app } = await setup();
  assert.equal(await issuePathOf(app.documents.previewStatement(null, undefined)), 'file');
  assert.equal(
    // Neither a PDF, nor an Excel file, nor text: a program or an image.
    await issuePathOf(app.documents.previewStatement(Buffer.from([0x4d, 0x5a, 0, 0, 0x90]), undefined)),
    'file',
  );

  app.pdf.error = new PdfReadError('password_required', 'locked');
  assert.equal(await issuePathOf(app.documents.previewStatement(pdfBytes, undefined)), 'password');
  app.pdf.error = new PdfReadError('wrong_password', 'wrong');
  assert.equal(await issuePathOf(app.documents.previewStatement(pdfBytes, 'mal')), 'password');
  app.pdf.error = new PdfReadError('too_many_pages', `${MAX_STATEMENT_PAGES + 1} pages`);
  assert.equal(await issuePathOf(app.documents.previewStatement(pdfBytes, undefined)), 'file');

  // A scanned statement has pages but no letters in them.
  app.pdf.error = null;
  app.pdf.pages = ['', '  \n 12 '];
  assert.equal(await issuePathOf(app.documents.previewStatement(pdfBytes, undefined)), 'file');
  app.pdf.pages = ['x'.repeat(MAX_STATEMENT_TEXT_LENGTH + 1)];
  assert.equal(await issuePathOf(app.documents.previewStatement(pdfBytes, undefined)), 'file');

  const offline = createMemoryBackend('2026-10-10', { aiConfigured: false });
  assert.equal(await codeOf(offline.documents.previewStatement(pdfBytes, undefined)), 'AI_PROVIDER');
});

test('the approved text is what the AI reads, and it is dropped on confirmation with its periods kept', async () => {
  const { app, visa, visaUsd } = await setup();
  app.ai.result = statementReading(line());
  const uploaded = await app.documents.uploadStatement({
    text: 'RESUMEN VISA\n02/10 SUPERMERCADO 2.500,00',
    fileName: 'resumen.pdf',
    accountId: visa.id,
  });
  assert.equal(uploaded.kind, 'card_statement');
  assert.equal(uploaded.fileCount, 0);
  assert.equal('text' in uploaded, false, 'the pending list does not carry the text');

  // The same text again is the same statement, already on its way.
  const again = await app.documents.uploadStatement({
    text: 'RESUMEN VISA\n02/10 SUPERMERCADO 2.500,00',
    fileName: '',
    accountId: undefined,
  });
  assert.equal(again.id, uploaded.id);

  await app.documents.processQueue();
  assert.equal(app.ai.calls[0]?.text, 'RESUMEN VISA\n02/10 SUPERMERCADO 2.500,00');
  assert.deepEqual(app.ai.calls[0]?.files, []);
  const ready = await app.documents.get(uploaded.id);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.text, 'RESUMEN VISA\n02/10 SUPERMERCADO 2.500,00');

  await app.documents.confirm(
    uploaded.id,
    confirmation(visa.id, {
      cardPeriods: [
        {
          accountIds: [visa.id, visaUsd.id],
          closingDate: '2026-10-08',
          dueDate: '2026-10-20',
          totalCents: 400000,
          minimumPaymentCents: 40000,
        },
        {
          accountIds: [visa.id],
          closingDate: '2026-11-05',
          dueDate: '2026-11-17',
          totalCents: null,
          minimumPaymentCents: null,
        },
      ],
    }),
  );
  assert.equal(app.store.cardPeriods.length, 3);
  assert.ok(app.store.cardPeriods.every((period) => period.documentId === uploaded.id));
  // The purchase took its payment date from the statement stored with it.
  assert.equal(app.store.transactions[0]?.paymentDate, '2026-10-20');
  assert.equal((await app.documents.get(uploaded.id)).text, null);

  // Deleting the statement keeps its dates, without the link to it.
  await app.documents.remove(uploaded.id, 'keep');
  assert.equal(app.store.cardPeriods.length, 3);
  assert.ok(app.store.cardPeriods.every((period) => period.documentId === null));
});

test('statement dates are only stored from a statement, all or nothing', async () => {
  const { app, visa } = await setup();
  const period = {
    accountIds: [visa.id],
    closingDate: '2026-10-08',
    dueDate: '2026-10-20',
    totalCents: null,
    minimumPaymentCents: null,
  };

  app.ai.result = { ...statementReading(line()), documentKind: 'receipt', statement: null };
  const receipt = await app.documents.upload({ kind: 'receipt' }, [
    {
      originalName: 'ticket.jpg',
      content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from('ticket......')]),
    },
  ]);
  await app.documents.processQueue();
  assert.equal(
    await issuePathOf(app.documents.confirm(receipt.id, confirmation(visa.id, { cardPeriods: [period] }))),
    'cardPeriods',
  );

  // A closing already typed by hand makes the whole confirmation fail, purchases included.
  await app.cardPeriods.create(period);
  app.ai.result = statementReading(line());
  const statement = await app.documents.uploadStatement({
    text: 'RESUMEN',
    fileName: '',
    accountId: undefined,
  });
  await app.documents.processQueue();
  assert.equal(
    await codeOf(app.documents.confirm(statement.id, confirmation(visa.id, { cardPeriods: [period] }))),
    'DUPLICATE',
  );
  assert.equal(app.store.transactions.length, 0);
  assert.equal(app.store.cardPeriods.length, 1);
  assert.equal((await app.documents.get(statement.id)).status, 'ready');
});

test('installments a statement charges now are dated on its closing day', async () => {
  const { app } = await setup();
  app.ai.result = statementReading(
    line({ date: '2026-07-15', installment: { number: 3, total: 6 }, uncertainFields: ['date'] }),
    line({ date: '2026-10-01', installment: { number: 1, total: 3 } }),
    line({ date: '2026-10-03' }),
  );
  const uploaded = await app.documents.uploadStatement({
    text: 'RESUMEN',
    fileName: '',
    accountId: undefined,
  });
  await app.documents.processQueue();
  const read = (await app.documents.get(uploaded.id)).extraction?.transactions ?? [];
  assert.deepEqual(
    read.map((transaction) => [transaction.date, transaction.uncertainFields]),
    [
      ['2026-10-08', []],
      ['2026-10-01', []],
      ['2026-10-03', []],
    ],
  );
});

test('without a closing date the installments keep the date the statement printed', () => {
  const reading = { ...statementReading(line({ date: '2026-07-15', installment: { number: 2, total: 6 } })) };
  reading.statement = { ...reading.statement!, closingDate: null };
  assert.equal(dateInstallmentsOnClosing(reading).transactions[0]?.date, '2026-07-15');
});

test('page text is tidied: no trailing spaces, no runs of empty lines, no empty pages', () => {
  assert.equal(tidyStatementText(['a  \n\n\n\nb\n', '', '\n c ']), 'a\n\nb\n\nc');
});

test('an installment of a purchase the app does not have can bring the ones still to come', async () => {
  const { app, visa } = await setup();
  app.ai.result = statementReading(
    line({ date: '2026-07-15', amountCents: 100000, installment: { number: 3, total: 6 } }),
  );
  const first = await app.documents.uploadStatement({ text: 'OCTUBRE', fileName: '', accountId: visa.id });
  await app.documents.processQueue();
  const [base] = confirmation(visa.id).transactions;
  const charged = { ...base!.transaction, date: '2026-10-08', amountCents: 100000 };
  const withPlan = (number: number) => ({
    transactions: [{ transaction: charged, installment: { number, total: 6 }, continuePlan: true }],
    rules: [],
    productRules: [],
    cardPeriods: [
      {
        accountIds: [visa.id],
        closingDate: '2026-10-08',
        dueDate: '2026-10-20',
        totalCents: null,
        minimumPaymentCents: null,
      },
      {
        accountIds: [visa.id],
        closingDate: '2026-11-05',
        dueDate: '2026-11-17',
        totalCents: null,
        minimumPaymentCents: null,
      },
    ],
  });

  // The last installment has nothing left to create.
  assert.equal(await codeOf(app.documents.confirm(first.id, withPlan(6))), 'VALIDATION');
  assert.equal(app.store.transactions.length, 0);

  await app.documents.confirm(first.id, withPlan(3));
  const [plan] = app.store.installmentPlans;
  assert.equal(plan?.installments, 6);
  assert.equal(plan?.totalAmountCents, 600000);
  assert.deepEqual(
    app.store.transactions.map((transaction) => [
      transaction.installment?.number,
      transaction.installment?.planId === plan?.id,
      transaction.date,
      transaction.status,
      transaction.paymentDate,
    ]),
    [
      [4, true, '2026-10-23', 'projected', '2026-11-17'],
      [5, true, '2026-11-23', 'projected', '2026-11-23'],
      [6, true, '2026-12-23', 'projected', '2026-12-23'],
      [3, true, '2026-10-08', 'confirmed', '2026-10-20'],
    ],
  );

  // Next month's statement charges installment 4: it is already there.
  app.ai.result = statementReading(
    line({ date: '2026-07-15', amountCents: 100000, installment: { number: 4, total: 6 } }),
  );
  const second = await app.documents.uploadStatement({ text: 'NOVIEMBRE', fileName: '', accountId: visa.id });
  await app.documents.processQueue();
  assert.deepEqual((await app.documents.get(second.id)).duplicateHints, ['existing']);
});
