import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractionResultSchema } from '@gastos/shared';
import { AiProviderError } from '../../core/errors/errors';
import { failureReason } from './aiExtractor';
import { extractJson, normalizeExtraction } from './normalize';

const food = 'a'.repeat(24);
const salary = 'b'.repeat(24);
const context = {
  kind: 'receipt' as const,
  today: '2026-10-10',
  categories: [
    { id: food, kind: 'expense' as const, path: 'Supermercado' },
    { id: salary, kind: 'income' as const, path: 'Sueldo' },
  ],
};

const answer = (transactions: unknown[], warnings: string[] = []) =>
  JSON.stringify({ transactions, warnings });

test('a clean answer becomes a valid extraction in cents', () => {
  const result = normalizeExtraction(
    answer([
      {
        type: 'expense',
        date: '2026-10-05',
        amount: '15400.50',
        currency: 'ARS',
        merchant: ' Coto ',
        description: 'Compra de supermercado',
        categoryId: food,
        installmentNumber: null,
        installmentTotal: null,
        items: [
          { name: 'LECHE LS 1L', amount: '1200.00', product: ' Leche ', group: 'Dairy', quantity: '2' },
          { name: 'Pan', amount: 850, product: 'Pan', group: 'golosinas', quantity: '0,350' },
          { name: 'Bolsa', amount: 50, quantity: -1 },
        ],
        uncertain: [],
      },
    ]),
    context,
  );
  assert.equal(extractionResultSchema.safeParse(result).success, true);
  assert.deepEqual(result.transactions, [
    {
      type: 'expense',
      refund: false,
      financialCharge: false,
      date: '2026-10-05',
      amountCents: 1540050,
      currency: 'ARS',
      merchant: 'Coto',
      description: 'Compra de supermercado',
      suggestedCategoryId: food,
      installment: null,
      items: [
        { name: 'LECHE LS 1L', amountCents: 120000, product: 'Leche', group: 'dairy', quantity: 2, productId: null, categoryId: null },
        { name: 'Pan', amountCents: 85000, product: 'Pan', group: null, quantity: 0.35, productId: null, categoryId: null },
        { name: 'Bolsa', amountCents: 5000, product: '', group: null, quantity: null, productId: null, categoryId: null },
      ],
      uncertainFields: [],
    },
  ]);
  assert.equal(result.documentKind, 'receipt');
  assert.equal(result.statement, null);
});

test('code fences and surrounding chatter are tolerated', () => {
  const wrapped = `Claro, acá está:\n\`\`\`json\n${answer([{ type: 'income', amount: '100', currency: 'USD', date: '05/10/2026' }])}\n\`\`\``;
  const [transaction] = normalizeExtraction(wrapped, context).transactions;
  assert.equal(transaction?.type, 'income');
  assert.equal(transaction?.amountCents, 10000);
  assert.equal(transaction?.date, '2026-10-05');
  assert.equal(transaction?.merchant, '');
});

test('Argentine number formats and negative signs are read as positive cents', () => {
  const amounts = ['15.400,50', '$ 1.500', '-320,10', 99.9, '0'];
  const result = normalizeExtraction(answer(amounts.map((amount) => ({ type: 'expense', amount }))), context);
  assert.deepEqual(
    result.transactions.map((transaction) => transaction.amountCents),
    [1540050, 150000, 32010, 9990, null],
  );
});

test('what cannot be trusted becomes null and is flagged, never guessed', () => {
  const result = normalizeExtraction(
    answer([
      {
        type: 'expense',
        date: '31/02/2026',
        amount: 'ilegible',
        currency: 'pesos',
        categoryId: 'no-existe',
        installmentNumber: 7,
        installmentTotal: 6,
        uncertain: ['merchant', 'cualquier cosa'],
      },
      { type: 'expense', date: '2027-01-01', amount: '10', currency: 'ARS', categoryId: salary },
    ]),
    context,
  );
  const [first, second] = result.transactions;
  assert.equal(first?.date, null);
  assert.equal(first?.amountCents, null);
  assert.equal(first?.currency, null);
  assert.equal(first?.suggestedCategoryId, null);
  assert.equal(first?.installment, null);
  assert.deepEqual([...(first?.uncertainFields ?? [])].sort(), [
    'amount',
    'currency',
    'date',
    'installment',
    'merchant',
  ]);
  // A date after today is a misread; an income category is not offered for an expense.
  assert.equal(second?.date, null);
  assert.equal(second?.suggestedCategoryId, null);
  assert.equal(extractionResultSchema.safeParse(result).success, true);
});

test('a currency the app has no accounts in is kept as read, not dropped', () => {
  const [transaction] = normalizeExtraction(
    answer([{ type: 'expense', amount: '50.00', currency: ' brl ' }]),
    context,
  ).transactions;
  assert.equal(transaction?.currency, 'BRL');
  assert.equal(transaction?.amountCents, 5000);
  assert.ok(!transaction?.uncertainFields.includes('currency'));
});

test('installments, transfers and unknown types', () => {
  const result = normalizeExtraction(
    answer([
      { type: 'expense', amount: '100', installmentNumber: 3, installmentTotal: 6 },
      { type: 'TRANSFER', amount: '100', categoryId: food },
      { type: 'compra', amount: '100' },
    ]),
    context,
  );
  assert.equal(result.transactions.length, 2);
  assert.deepEqual(result.transactions[0]?.installment, { number: 3, total: 6 });
  assert.equal(result.transactions[1]?.type, 'transfer');
  assert.equal(result.transactions[1]?.suggestedCategoryId, null);
  assert.equal(result.warnings.length, 1);
});

test('an image without transactions is a valid, empty extraction', () => {
  const result = normalizeExtraction(answer([], ['La imagen no muestra un comprobante.']), context);
  assert.deepEqual(result.transactions, []);
  assert.deepEqual(result.warnings, ['La imagen no muestra un comprobante.']);
});

test('answers that are not JSON, or not the agreed shape, fail as unreadable', () => {
  for (const bad of ['no pude leer la imagen', '{ "transactions": [', '{"transactions": "muchas"}']) {
    assert.throws(
      () => normalizeExtraction(bad, context),
      (error: unknown) => error instanceof AiProviderError && failureReason(error) === 'unreadable',
    );
  }
  assert.deepEqual(extractJson('x {"a": 1} y'), { a: 1 });
});

test("a card statement's dates and amounts are read, future dates included", () => {
  const answer = JSON.stringify({
    transactions: [],
    statement: {
      closingDate: '2026-10-08',
      dueDate: '2026-10-20',
      nextClosingDate: '05/11/2026',
      nextDueDate: 'mañana',
      total: '4000.00',
      minimumPayment: 400,
      currency: 'ars',
    },
    warnings: [],
  });
  const result = normalizeExtraction(answer, { ...context, kind: 'card_statement' });
  assert.equal(extractionResultSchema.safeParse(result).success, true);
  assert.deepEqual(result.statement, {
    closingDate: '2026-10-08',
    dueDate: '2026-10-20',
    nextClosingDate: '2026-11-05',
    nextDueDate: null,
    totalCents: 400000,
    minimumPaymentCents: 40000,
    currency: 'ARS',
  });

  // Only a statement has statement data, whatever the model sends.
  assert.equal(normalizeExtraction(answer, context).statement, null);
  assert.equal(
    normalizeExtraction(JSON.stringify({ transactions: [] }), { ...context, kind: 'card_statement' })
      .statement,
    null,
  );
});

test('only an expense is kept as a refund', () => {
  const result = normalizeExtraction(
    answer([
      { type: 'expense', refund: true, amount: '10', currency: 'ARS' },
      { type: 'income', refund: true, amount: '10', currency: 'ARS' },
      { type: 'expense', amount: '10', currency: 'ARS' },
    ]),
    context,
  );
  assert.deepEqual(
    result.transactions.map((transaction) => transaction.refund),
    [true, false, false],
  );
});

test('only an expense is kept as a financial charge', () => {
  const result = normalizeExtraction(
    answer([
      { type: 'expense', financialCharge: true, amount: '10', currency: 'ARS' },
      { type: 'income', financialCharge: true, amount: '10', currency: 'ARS' },
      { type: 'expense', amount: '10', currency: 'ARS' },
    ]),
    context,
  );
  assert.deepEqual(
    result.transactions.map((transaction) => transaction.financialCharge),
    [true, false, false],
  );
});

test("an account's statement keeps its balances' sign and each transfer's direction", () => {
  const reply = JSON.stringify({
    transactions: [
      { type: 'transfer', incoming: true, date: '2026-10-02', amount: '1000.00', currency: 'ARS' },
      { type: 'transfer', date: '2026-10-03', amount: '500.00', currency: 'ARS' },
      { type: 'expense', incoming: true, date: '2026-10-04', amount: '300.00', currency: 'ARS' },
    ],
    statement: {
      fromDate: '01/10/2026',
      toDate: '2026-10-09',
      openingBalance: '-1500.50',
      closingBalance: 0,
      currency: 'ARS',
    },
    warnings: [],
  });
  const result = normalizeExtraction(reply, { ...context, kind: 'account_statement' });
  assert.equal(extractionResultSchema.safeParse(result).success, true);
  assert.deepEqual(
    result.transactions.map((transaction) => [transaction.type, transaction.incoming]),
    [
      ['transfer', true],
      ['transfer', false],
      // Only a transfer has a direction.
      ['expense', false],
    ],
  );
  assert.deepEqual(
    [
      result.statement?.fromDate,
      result.statement?.toDate,
      result.statement?.openingBalanceCents,
      result.statement?.closingBalanceCents,
      result.statement?.closingDate,
    ],
    ['2026-10-01', '2026-10-09', -150050, 0, null],
  );
  // A card's statement has no direction on its lines.
  const card = normalizeExtraction(reply, { ...context, kind: 'card_statement' });
  assert.equal(card.transactions[0]?.incoming, undefined);
});
