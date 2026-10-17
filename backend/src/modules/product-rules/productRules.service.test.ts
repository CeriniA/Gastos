import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExtractionResult, TransactionItem } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { createMemoryBackend } from '../../testing/memory';

/** Products corrected in a review are offered again on the next receipts. */

const photo = (label: string) => ({
  originalName: `${label}.jpg`,
  content: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(label.padEnd(16, '.'))]),
});

const yerba: TransactionItem = {
  name: 'YERB.PLAY 1000',
  amountCents: 5200,
  product: 'Yerba mate',
  group: null,
  quantity: 1,
};

const receipt = (items: TransactionItem[]): ExtractionResult => ({
  documentKind: 'receipt',
  statement: null,
  warnings: [],
  transactions: [
    {
      type: 'expense',
      refund: false,
      financialCharge: false,
      date: '2026-10-05',
      amountCents: 5200,
      currency: 'ARS',
      merchant: 'Coto',
      description: 'Compra',
      suggestedCategoryId: null,
      installment: null,
      items,
      uncertainFields: [],
    },
  ],
});

test('a product corrected and remembered in a review is how the next receipt offers that line', async () => {
  const app = createMemoryBackend('2026-10-10');
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  app.ai.result = receipt([yerba]);

  const first = await app.documents.upload({ kind: 'receipt' }, [photo('uno')]);
  await app.documents.processQueue();
  await app.documents.confirm(first.id, {
    transactions: [
      {
        transaction: {
          type: 'expense',
          refund: false,
          date: '2026-10-05',
          amountCents: 5200,
          currency: 'ARS',
          accountId: bank.id,
          categoryId: null,
          description: 'Coto',
          note: '',
          tagIds: [],
          splits: [],
          toAccountId: null,
          toAmountCents: null,
          paymentDate: null,
          original: null,
          items: [{ ...yerba, product: 'Yerba', group: 'pantry' }],
        },
        installment: null,
        continuePlan: false,
      },
    ],
    rules: [],
    productRules: [{ name: 'YERB.PLAY 1000', product: 'Yerba', group: 'pantry' }],
    cardPeriods: [],
  });
  assert.deepEqual(
    (await app.productRules.list()).map((rule) => [rule.name, rule.product, rule.group]),
    [['YERB.PLAY 1000', 'Yerba', 'pantry']],
  );

  // The AI reads the same line its old way again; the review offers the user's correction.
  const other: TransactionItem = { ...yerba, name: 'LECHE 1L', product: 'Leche', group: 'dairy' };
  app.ai.result = receipt([{ ...yerba, name: 'yerb.play 1000' }, other]);
  const second = await app.documents.upload({ kind: 'receipt' }, [photo('dos')]);
  await app.documents.processQueue();
  const items = (await app.documents.get(second.id)).extraction?.transactions[0]?.items;
  assert.deepEqual(
    items?.map((item) => [item.name, item.product, item.group]),
    [
      ['yerb.play 1000', 'Yerba', 'pantry'],
      ['LECHE 1L', 'Leche', 'dairy'],
    ],
  );

  // Forgotten, the line is read as the AI reads it.
  const [rule] = await app.productRules.list();
  await app.productRules.remove(rule!.id);
  assert.deepEqual(await app.productRules.list(), []);
  assert.equal(await codeOf(app.productRules.remove(rule!.id)), 'NOT_FOUND');
});

test('remembering the same printed line again replaces what it said', async () => {
  const app = createMemoryBackend('2026-10-10');
  await app.productRules.save({ name: 'YERB.PLAY 1000', product: 'Yerba', group: 'pantry' });
  await app.productRules.save({ name: ' yerb.play 1000 ', product: 'Yerba compuesta', group: 'pantry' });
  assert.deepEqual(
    (await app.productRules.list()).map((rule) => rule.product),
    ['Yerba compuesta'],
  );
});
