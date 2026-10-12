import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_DOCUMENT_FILES,
  type DocumentConfirm,
  type ExtractedTransaction,
  type ExtractionResult,
} from '@gastos/shared';
import { AppError } from '../../core/errors/errors';
import { extractionFailure } from '../../providers/ai/aiExtractor';
import { createMemoryBackend } from '../../testing/memory';
import { detectImageType } from './fileType';

/** Upload → AI reading → review → confirmation, over the in-memory backend and a scripted AI. */

const jpeg = (label: string) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(label.padEnd(16, '.'))]);
const png = (label: string) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(label.padEnd(16, '.')),
  ]);
const photo = (label: string) => ({ originalName: `${label}.jpg`, content: jpeg(label) });

async function codeOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof AppError, `expected an AppError, got ${String(error)}`);
    return error.code;
  }
  assert.fail('expected the operation to be rejected');
}

const read = (overrides: Partial<ExtractedTransaction> = {}): ExtractedTransaction => ({
  type: 'expense',
  date: '2026-10-05',
  amountCents: 1540050,
  currency: 'ARS',
  merchant: 'Edesur',
  description: 'Factura de luz',
  suggestedCategoryId: null,
  installment: null,
  items: [],
  uncertainFields: [],
  ...overrides,
});
const extraction = (...transactions: ExtractedTransaction[]): ExtractionResult => ({
  documentKind: 'receipt',
  transactions,
  statement: null,
  warnings: [],
});

async function setup() {
  const app = createMemoryBackend('2026-10-10');
  const bank = await app.accounts.create({ name: 'Banco', type: 'bank', currency: 'ARS' });
  const home = await app.categories.create({ name: 'Vivienda', kind: 'expense', parentId: null });
  const power = await app.categories.create({ name: 'Luz', kind: 'expense', parentId: home.id });
  const food = await app.categories.create({ name: 'Supermercado', kind: 'expense', parentId: null });
  const salary = await app.categories.create({ name: 'Sueldo', kind: 'income', parentId: null });
  return { app, bank, home, power, food, salary };
}

function confirmation(
  accountId: string,
  categoryId: string | null,
  overrides: Partial<DocumentConfirm> = {},
): DocumentConfirm {
  return {
    transactions: [
      {
        transaction: {
          type: 'expense',
          date: '2026-10-05',
          amountCents: 1540050,
          currency: 'ARS',
          accountId,
          categoryId,
          description: 'Factura de luz',
          note: '',
          tagIds: [],
          splits: [],
          toAccountId: null,
          toAmountCents: null,
          paymentDate: null,
          original: null,
          items: [{ name: 'Consumo', amountCents: 1540050, product: '', group: null, quantity: null }],
        },
        installment: null,
      },
    ],
    rules: [],
    ...overrides,
  };
}

test('file types are recognised by their bytes, not their names', () => {
  assert.equal(detectImageType(jpeg('a')), 'image/jpeg');
  assert.equal(detectImageType(png('a')), 'image/png');
  assert.equal(detectImageType(Buffer.from('RIFF1234WEBPVP8 ....')), 'image/webp');
  assert.equal(detectImageType(Buffer.from('%PDF-1.7 ..........')), null);
  assert.equal(detectImageType(Buffer.from('MZ'.padEnd(20, '.'))), null);
  assert.equal(detectImageType(Buffer.from('')), null);
});

test('an upload answers at once and is read in the background', async () => {
  const { app, bank, power } = await setup();
  app.ai.result = extraction(read({ suggestedCategoryId: power.id }));

  const uploaded = await app.documents.upload({ kind: 'receipt', accountId: bank.id }, [photo('luz')]);
  assert.equal(uploaded.status, 'processing');
  assert.equal(uploaded.transactionCount, null);
  assert.equal(app.ai.calls.length, 0);

  await app.documents.processQueue();
  const ready = await app.documents.get(uploaded.id);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.fileCount, 1);
  assert.equal(ready.promptVersion, 1);
  assert.equal(ready.extraction?.transactions[0]?.suggestedCategoryId, power.id);
  assert.equal(ready.extraction?.transactions[0]?.categoryFromRule, false);

  // The AI got the image, today's date, and the categories as full paths.
  const [call] = app.ai.calls;
  assert.equal(call?.files[0]?.mimeType, 'image/jpeg');
  assert.equal(call?.today, '2026-10-10');
  assert.ok(call?.categories.some((category) => category.path === 'Vivienda > Luz'));
  // Nothing is a transaction until the user confirms.
  assert.equal(app.store.transactions.length, 0);
});

test('uploads are validated before anything is stored', async () => {
  const { app, bank } = await setup();
  const upload = (files: { originalName: string; content: Buffer }[], accountId?: string) =>
    app.documents.upload({ kind: 'receipt', accountId }, files);

  assert.equal(await codeOf(upload([])), 'VALIDATION');
  assert.equal(
    await codeOf(upload([{ originalName: 'virus.jpg', content: Buffer.from('MZ'.padEnd(40, '.')) }])),
    'VALIDATION',
  );
  assert.equal(
    await codeOf(upload(Array.from({ length: MAX_DOCUMENT_FILES + 1 }, (_, n) => photo(`p${n}`)))),
    'VALIDATION',
  );
  assert.equal(await codeOf(upload([photo('a')], 'f'.repeat(24))), 'VALIDATION');
  await app.accounts.update(bank.id, { archived: true });
  assert.equal(await codeOf(upload([photo('a')], bank.id)), 'VALIDATION');
  assert.equal(app.store.documents.length, 0);

  const off = createMemoryBackend('2026-10-10', { aiConfigured: false });
  assert.equal(await codeOf(off.documents.upload({ kind: 'receipt' }, [photo('a')])), 'AI_PROVIDER');
});

test('uploading a file again reads it again, unless it is already counted', async () => {
  const { app, bank, power } = await setup();
  app.ai.result = extraction(read());

  // Still being read: the same upload is simply the same document.
  const first = await app.documents.upload({ kind: 'receipt' }, [photo('ticket')]);
  assert.equal((await app.documents.upload({ kind: 'receipt' }, [photo('ticket')])).id, first.id);
  assert.equal(app.store.documents.length, 1);

  // Read but not confirmed: nothing was stored from it, so a new upload replaces it and is read afresh.
  await app.documents.processQueue();
  const second = await app.documents.upload({ kind: 'screenshot' }, [photo('ticket')]);
  assert.notEqual(second.id, first.id);
  assert.equal(second.status, 'processing');
  assert.equal(second.kind, 'screenshot');
  assert.deepEqual(
    app.store.documents.map((document) => document.id),
    [second.id],
  );

  // Failed: same thing.
  app.ai.error = extractionFailure('unavailable', 'down');
  await app.documents.processQueue();
  assert.equal((await app.documents.get(second.id)).status, 'error');
  app.ai.error = null;
  const third = await app.documents.upload({ kind: 'receipt' }, [photo('ticket')]);
  assert.equal(app.store.documents.length, 1);

  // Confirmed, with a transaction that counts: now it really is a duplicate.
  await app.documents.processQueue();
  await app.documents.confirm(third.id, confirmation(bank.id, power.id));
  assert.equal(await codeOf(app.documents.upload({ kind: 'receipt' }, [photo('ticket')])), 'DUPLICATE');

  // Several parts are one document: the same parts in another order are a different upload.
  const parts = await app.documents.upload({ kind: 'receipt' }, [photo('parte1'), photo('parte2')]);
  const swapped = await app.documents.upload({ kind: 'receipt' }, [photo('parte2'), photo('parte1')]);
  assert.notEqual(swapped.id, parts.id);
});

test("the user's rule for a merchant wins over the AI, and bad suggestions are dropped", async () => {
  const { app, power, food, salary } = await setup();
  await app.categoryRules.save({ merchant: 'EDESUR', categoryId: power.id });
  await app.categories.update(food.id, { archived: true });
  app.ai.result = extraction(
    read({ merchant: 'edesur', suggestedCategoryId: food.id }),
    read({ merchant: 'Coto', suggestedCategoryId: food.id }), // archived
    read({ merchant: 'Kiosco', suggestedCategoryId: salary.id }), // wrong kind
    read({ merchant: 'Otro', suggestedCategoryId: 'e'.repeat(24) }), // does not exist
    read({ merchant: 'Edesur', type: 'income', suggestedCategoryId: salary.id }), // rule is for expenses
  );
  const uploaded = await app.documents.upload({ kind: 'receipt' }, [photo('varios')]);
  await app.documents.processQueue();

  const suggestions = (await app.documents.get(uploaded.id)).extraction?.transactions.map((transaction) => [
    transaction.suggestedCategoryId,
    transaction.categoryFromRule,
  ]);
  assert.deepEqual(suggestions, [
    [power.id, true],
    [null, false],
    [null, false],
    [null, false],
    [salary.id, false],
  ]);
});

test('confirming creates the transactions, remembers rules and deletes the image', async () => {
  const { app, bank, power } = await setup();
  app.ai.result = extraction(read());
  const uploaded = await app.documents.upload({ kind: 'receipt' }, [photo('luz')]);
  assert.equal(await codeOf(app.documents.confirm(uploaded.id, confirmation(bank.id, power.id))), 'CONFLICT'); // still processing
  await app.documents.processQueue();
  assert.equal((await app.documents.getFile(uploaded.id, 0)).mimeType, 'image/jpeg');

  const result = await app.documents.confirm(
    uploaded.id,
    confirmation(bank.id, power.id, { rules: [{ merchant: 'Edesur', categoryId: power.id }] }),
  );
  assert.deepEqual(result, { created: 1 });

  const [transaction] = app.store.transactions;
  assert.equal(transaction?.source, 'document');
  assert.equal(transaction?.documentId, uploaded.id);
  assert.equal(transaction?.status, 'confirmed');
  assert.equal(transaction?.categoryId, power.id);
  assert.deepEqual(transaction?.items, [
    { name: 'Consumo', amountCents: 1540050, product: '', group: null, quantity: null },
  ]);

  const confirmed = await app.documents.get(uploaded.id);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.fileCount, 0);
  assert.equal(await codeOf(app.documents.getFile(uploaded.id, 0)), 'NOT_FOUND');
  assert.deepEqual(
    (await app.categoryRules.list()).map((rule) => [rule.merchant, rule.categoryId]),
    [['Edesur', power.id]],
  );

  // Out of the pending tray, still listed among all documents, and not confirmable twice.
  assert.deepEqual(await app.documents.list('pending'), []);
  assert.equal((await app.documents.list('all')).length, 1);
  assert.equal(await codeOf(app.documents.confirm(uploaded.id, confirmation(bank.id, power.id))), 'CONFLICT');
  assert.equal(await codeOf(app.documents.upload({ kind: 'receipt' }, [photo('luz')])), 'DUPLICATE');
});

test('a confirmation that fails half-way leaves everything as it was', async () => {
  const { app, bank, power, salary } = await setup();
  app.ai.result = extraction(read());
  const uploaded = await app.documents.upload({ kind: 'receipt' }, [photo('luz')]);
  await app.documents.processQueue();

  // An invalid transaction: nothing is created.
  assert.equal(
    await codeOf(app.documents.confirm(uploaded.id, confirmation(bank.id, salary.id))),
    'VALIDATION',
  );
  // A write that fails after validation: the rule saved alongside is rolled back too.
  app.faults.insertTransactions = true;
  await assert.rejects(
    app.documents.confirm(
      uploaded.id,
      confirmation(bank.id, power.id, { rules: [{ merchant: 'Edesur', categoryId: power.id }] }),
    ),
    /simulated write failure/,
  );
  assert.equal(app.store.transactions.length, 0);
  assert.equal(app.store.rules.length, 0);
  const still = await app.documents.get(uploaded.id);
  assert.equal(still.status, 'ready');
  assert.equal(still.fileCount, 1);

  app.faults.insertTransactions = false;
  assert.deepEqual(await app.documents.confirm(uploaded.id, confirmation(bank.id, power.id)), { created: 1 });
});

test('a failed reading is kept with its reason and can be retried', async () => {
  const { app } = await setup();
  app.ai.error = extractionFailure('rate_limited', 'quota exhausted');
  const uploaded = await app.documents.upload({ kind: 'screenshot' }, [photo('mp')]);
  await app.documents.processQueue();

  const failed = await app.documents.get(uploaded.id);
  assert.equal(failed.status, 'error');
  assert.equal(failed.errorCode, 'rate_limited');
  assert.equal(failed.fileCount, 1);
  assert.equal(app.errors.length, 1);
  assert.equal((await app.documents.list('pending')).length, 1);

  app.ai.error = null;
  app.ai.result = { ...extraction(read()), documentKind: 'screenshot' };
  assert.equal((await app.documents.retry(uploaded.id)).status, 'processing');
  assert.equal(await codeOf(app.documents.retry(uploaded.id)), 'CONFLICT'); // already being read
  await app.documents.processQueue();
  const ready = await app.documents.get(uploaded.id);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.errorCode, null);

  // A document already read can be read again too; the old result is dropped meanwhile.
  const again = await app.documents.retry(uploaded.id);
  assert.equal(again.status, 'processing');
  assert.equal(again.transactionCount, null);
  await app.documents.processQueue();
  assert.equal((await app.documents.get(uploaded.id)).status, 'ready');
});

test('an unexpected failure or an invalid extraction never leaves a document stuck', async () => {
  const { app } = await setup();
  app.ai.error = new Error('socket hang up');
  const crashed = await app.documents.upload({ kind: 'receipt' }, [photo('a')]);
  await app.documents.processQueue();
  assert.equal((await app.documents.get(crashed.id)).errorCode, 'unavailable');

  app.ai.error = null;
  app.ai.result = { ...extraction(read()), transactions: [{ ...read(), amountCents: -5 }] };
  const invalid = await app.documents.upload({ kind: 'receipt' }, [photo('b')]);
  await app.documents.processQueue();
  const stored = await app.documents.get(invalid.id);
  assert.equal(stored.status, 'error');
  assert.equal(stored.errorCode, 'unreadable');
  assert.equal(stored.extraction, null);
});

test('the queue reads waiting documents oldest first, each once', async () => {
  const { app } = await setup();
  app.ai.result = extraction(read());
  const first = await app.documents.upload({ kind: 'receipt' }, [photo('uno')]);
  const second = await app.documents.upload({ kind: 'receipt' }, [
    photo('dos'),
    { originalName: 'dos-b.png', content: png('dos-b') },
  ]);
  await Promise.all([app.documents.processQueue(), app.documents.processQueue()]);

  assert.equal(app.ai.calls.length, 2);
  assert.deepEqual(
    app.ai.calls.map((call) => call.files.map((file) => file.mimeType)),
    [['image/jpeg'], ['image/jpeg', 'image/png']],
  );
  assert.deepEqual(
    (await app.documents.list('pending')).map((document) => [document.id, document.status]),
    [
      [second.id, 'ready'],
      [first.id, 'ready'],
    ],
  );
});

test('deleting a confirmed document keeps its transactions as manual, or sends them to the trash', async () => {
  const { app, bank, power } = await setup();
  app.ai.result = extraction(read());

  const kept = await app.documents.upload({ kind: 'receipt' }, [photo('uno')]);
  const trashed = await app.documents.upload({ kind: 'receipt' }, [photo('dos')]);
  await app.documents.processQueue();
  await app.documents.confirm(kept.id, confirmation(bank.id, power.id));
  await app.documents.confirm(trashed.id, confirmation(bank.id, power.id));

  await app.documents.remove(kept.id, 'keep');
  await app.documents.remove(trashed.id, 'delete');
  assert.equal(app.store.documents.length, 0);

  const live = (await app.transactions.list({ page: 1, pageSize: 50 })).items;
  assert.equal(live.length, 1);
  assert.equal(live[0]?.documentId, null);
  assert.equal(live[0]?.source, 'manual');
  const inTrash = (await app.transactions.list({ page: 1, pageSize: 50, deleted: true })).items;
  assert.equal(inTrash.length, 1);
  assert.equal(inTrash[0]?.documentId, null);
  assert.equal(await codeOf(app.documents.remove(kept.id, 'keep')), 'NOT_FOUND');
});

test('a receipt in another currency is stored in the account currency, with what it said kept alongside', async () => {
  const { app, bank, food } = await setup();
  app.ai.result = extraction(read({ merchant: 'Supermercado Bistek', amountCents: 5000, currency: 'BRL' }));
  const uploaded = await app.documents.upload({ kind: 'receipt' }, [photo('brasil')]);
  await app.documents.processQueue();
  assert.equal((await app.documents.get(uploaded.id)).extraction?.transactions[0]?.currency, 'BRL');
  assert.deepEqual(await app.transactions.lastRate('BRL'), { rate: null, date: null });

  const base = confirmation(bank.id, food.id).transactions[0]!;
  const converted = (
    original: { amountCents: number; currency: string; rate: number },
    amountCents: number,
    date: string,
  ) => ({
    transactions: [{ ...base, transaction: { ...base.transaction, date, amountCents, original } }],
    rules: [],
  });

  // The original currency must be a different one: converting pesos to pesos is a mistake.
  assert.equal(
    await codeOf(
      app.documents.confirm(
        uploaded.id,
        converted({ amountCents: 5000, currency: 'ARS', rate: 1 }, 5000, '2026-10-05'),
      ),
    ),
    'VALIDATION',
  );

  await app.documents.confirm(
    uploaded.id,
    converted({ amountCents: 5000, currency: 'BRL', rate: 272.5 }, 1362500, '2026-10-05'),
  );
  const [stored] = app.store.transactions;
  assert.equal(stored?.currency, 'ARS');
  assert.equal(stored?.amountCents, 1362500);
  assert.deepEqual(stored?.original, { amountCents: 5000, currency: 'BRL', rate: 272.5 });

  // The monthly balance only ever sees pesos.
  assert.deepEqual((await app.transactions.summary('2026-10')).totals, [
    { currency: 'ARS', incomeCents: 0, expenseCents: 1362500, balanceCents: -1362500 },
  ]);
  // The next conversion starts from the last rate used for that currency.
  assert.deepEqual(await app.transactions.lastRate('BRL'), { rate: 272.5, date: '2026-10-05' });
  assert.deepEqual(await app.transactions.lastRate('EUR'), { rate: null, date: null });

  // Editing something else leaves the original untouched.
  const edited = await app.transactions.update(stored!.id, { note: 'compra en Brasil' });
  assert.deepEqual(edited.original, { amountCents: 5000, currency: 'BRL', rate: 272.5 });

  // Correcting the amount corrects the rate with it, and the products follow in proportion.
  const before = edited.items[0]!.amountCents;
  const corrected = await app.transactions.update(stored!.id, { amountCents: 1500000 });
  assert.deepEqual(corrected.original, { amountCents: 5000, currency: 'BRL', rate: 300 });
  assert.equal(corrected.items[0]?.amountCents, Math.round((before * 1500000) / 1362500));
  assert.deepEqual(await app.transactions.lastRate('BRL'), { rate: 300, date: '2026-10-05' });

  assert.equal((await app.transactions.update(stored!.id, { original: null })).original, null);
});

test('uploads nobody reviewed are dropped after the retention period; confirmed ones stay', async () => {
  const { app, bank, power } = await setup();
  app.ai.result = extraction(read());
  const kept = await app.documents.upload({ kind: 'receipt' }, [photo('confirmado')]);
  const forgotten = await app.documents.upload({ kind: 'receipt' }, [photo('olvidado')]);
  await app.documents.processQueue();
  await app.documents.confirm(kept.id, confirmation(bank.id, power.id));

  const uploadedAt = new Date(app.store.documents[0]!.createdAt).getTime();
  const day = 24 * 60 * 60 * 1000;
  assert.equal(await app.documents.purgeStale(new Date(uploadedAt + 29 * day)), 0);
  assert.equal(await app.documents.purgeStale(new Date(uploadedAt + 31 * day)), 1);
  assert.deepEqual(
    app.store.documents.map((document) => document.id),
    [kept.id],
  );
  assert.equal(await codeOf(app.documents.get(forgotten.id)), 'NOT_FOUND');
  assert.equal(app.store.transactions.length, 1);
});

test('a receipt can be uploaded again once all its transactions were deleted', async () => {
  const { app, bank, power } = await setup();
  app.ai.result = extraction(read(), read({ merchant: 'Otro' }));
  const first = await app.documents.upload({ kind: 'receipt' }, [photo('luz')]);
  await app.documents.processQueue();
  const both = confirmation(bank.id, power.id).transactions[0]!;
  await app.documents.confirm(first.id, { transactions: [both, both], rules: [] });
  const [one, two] = app.store.transactions;

  // While one of its transactions still counts, the upload is a duplicate.
  await app.transactions.remove(one!.id);
  assert.equal(await codeOf(app.documents.upload({ kind: 'receipt' }, [photo('luz')])), 'DUPLICATE');

  // With every transaction in the trash, the old document makes way for the new one.
  await app.transactions.remove(two!.id);
  const second = await app.documents.upload({ kind: 'receipt' }, [photo('luz')]);
  assert.equal(second.status, 'processing');
  assert.notEqual(second.id, first.id);
  assert.deepEqual(
    app.store.documents.map((document) => document.id),
    [second.id],
  );

  // The trashed transactions no longer point at the deleted document, and can still be restored.
  assert.ok(app.store.transactions.every((transaction) => transaction.documentId === null));
  assert.equal((await app.transactions.restore(one!.id)).deletedAt, null);
});

test('movements that look repeated are pointed out, against stored ones and within the document', async () => {
  const { app, bank, power } = await setup();
  // Already stored: an expense of $ 15.400,50 on Oct 5, and a purchase in Brazil of R$ 50 on Oct 6.
  await app.transactions.create({ ...confirmation(bank.id, power.id).transactions[0]!.transaction });
  await app.transactions.create({
    ...confirmation(bank.id, power.id).transactions[0]!.transaction,
    date: '2026-10-06',
    amountCents: 1500000,
    original: { amountCents: 5000, currency: 'BRL', rate: 300 },
  });

  app.ai.result = extraction(
    read(), // same day and amount as the stored one
    read({ date: '2026-10-06', amountCents: 5000, currency: 'BRL' }), // matches the stored receipt in reais
    read({ date: '2026-10-07', amountCents: 9900 }), // new
    read({ date: '2026-10-07', amountCents: 9900 }), // the same line captured twice
    read({ date: '2026-10-07', amountCents: 9900, merchant: 'Otra persona' }), // same day and amount, someone else
    read({ date: '2026-10-05', amountCents: 1540050, currency: 'USD' }), // same figure, other currency
    read({ date: null }), // cannot be compared
  );
  const uploaded = await app.documents.upload({ kind: 'screenshot' }, [photo('lista-1'), photo('lista-2')]);
  assert.deepEqual((await app.documents.get(uploaded.id)).duplicateHints, []); // nothing read yet
  await app.documents.processQueue();

  assert.deepEqual((await app.documents.get(uploaded.id)).duplicateHints, [
    'existing',
    'existing',
    null,
    'repeated',
    null,
    null,
    null,
  ]);

  // The hints follow the data: once the stored one is deleted, it is no longer a repeat.
  const [first] = app.store.transactions;
  await app.transactions.remove(first!.id);
  assert.equal((await app.documents.get(uploaded.id)).duplicateHints[0], null);
});
