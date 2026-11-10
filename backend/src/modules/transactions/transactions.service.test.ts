import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Account, Category, Tag, Transaction, TransactionCreate } from '@gastos/shared';
import { NotFoundError, ValidationError } from '../../core/errors/errors';
import type { TransactionRecord, TransactionsRepository } from './transactions.repository';
import { createTransactionsService } from './transactions.service';

/**
 * Business rules of the transactions service, exercised against an in-memory
 * repository. No database involved.
 */

const stamp = '2026-10-01T00:00:00.000Z';
const id = (letter: string) => letter.repeat(24);

const accounts: Account[] = [
  {
    id: id('a'),
    name: 'Banco',
    type: 'bank',
    currency: 'ARS',
    bankId: null,
    networkId: null,
    openingBalance: null,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: id('b'),
    name: 'Visa',
    type: 'credit_card',
    currency: 'ARS',
    bankId: null,
    networkId: null,
    openingBalance: null,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: id('c'),
    name: 'Caja USD',
    type: 'cash',
    currency: 'USD',
    bankId: null,
    networkId: null,
    openingBalance: null,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: id('d'),
    name: 'Vieja',
    type: 'bank',
    currency: 'ARS',
    bankId: null,
    networkId: null,
    openingBalance: null,
    archived: true,
    createdAt: stamp,
    updatedAt: stamp,
  },
];
const category = (letter: string, kind: Category['kind'], archived = false): Category => ({
  id: id(letter),
  name: letter,
  kind,
  parentId: null,
  role: null,
  depth: 1,
  archived,
  createdAt: stamp,
  updatedAt: stamp,
});
const categories = [category('1', 'expense'), category('2', 'income'), category('3', 'expense', true)];
const tags: Tag[] = [{ id: id('e'), name: 'casa', createdAt: stamp, updatedAt: stamp }];

function setup() {
  const stored = new Map<string, Transaction>();
  let counter = 0;
  const repository = {
    async insertMany(records: readonly TransactionRecord[]) {
      return records.map((record) => {
        counter += 1;
        const transaction: Transaction = {
          ...record,
          id: String(counter).padStart(24, '0'),
          createdAt: stamp,
          updatedAt: stamp,
          deletedAt: null,
        };
        stored.set(transaction.id, transaction);
        return transaction;
      });
    },
    async findById(transactionId: string) {
      return stored.get(transactionId) ?? null;
    },
    async replace(transactionId: string, record: TransactionRecord) {
      const current = stored.get(transactionId);
      if (!current) return null;
      const next = { ...current, ...record };
      stored.set(transactionId, next);
      return next;
    },
    async setDeleted(transactionId: string, deletedAt: Date | null) {
      const current = stored.get(transactionId);
      if (!current || (deletedAt === null) === (current.deletedAt === null)) return false;
      stored.set(transactionId, { ...current, deletedAt: deletedAt ? deletedAt.toISOString() : null });
      return true;
    },
  } as unknown as TransactionsRepository;

  const service = createTransactionsService(repository, {
    listAccounts: async () => accounts,
    listCategories: async () => categories,
    listTags: async () => tags,
    listMerchants: async () => [],
    listProducts: async () => [],
    listCardPeriods: async () => [],
    today: () => '2026-10-10',
    now: () => new Date('2026-10-10T12:00:00.000Z'),
  });
  return { service, stored };
}

const expense: TransactionCreate = {
  type: 'expense',
  date: '2026-10-05',
  amountCents: 150000,
  currency: 'ARS',
  accountId: id('a'),
  categoryId: id('1'),
  description: 'Super',
  merchantId: null,
  note: '',
  tagIds: [id('e')],
  splits: [],
  toAccountId: null,
  toAmountCents: null,
  paymentDate: null,
  original: null,
  refund: false,
  items: [],
};

async function issuePaths(work: Promise<unknown>): Promise<string[]> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof ValidationError, `expected ValidationError, got ${String(error)}`);
    const details = error.details as { issues: { path: string }[] };
    return details.issues.map((issue) => issue.path).sort();
  }
  assert.fail('expected the operation to be rejected');
}

test('a manual expense is stored confirmed and paid the same day', async () => {
  const { service } = setup();
  const created = await service.create(expense);
  assert.equal(created.status, 'confirmed');
  assert.equal(created.source, 'manual');
  assert.equal(created.paymentDate, '2026-10-05');
  assert.equal(created.edited, false);
});

test('a credit card purchase keeps the payment date the user gave', async () => {
  const { service } = setup();
  const created = await service.create({ ...expense, accountId: id('b'), paymentDate: '2026-11-10' });
  assert.equal(created.paymentDate, '2026-11-10');
  const bank = await service.create({ ...expense, paymentDate: '2026-11-10' });
  assert.equal(bank.paymentDate, '2026-10-05');
});

test('references must exist, match and not be archived', async () => {
  const { service } = setup();
  assert.deepEqual(await issuePaths(service.create({ ...expense, accountId: id('f') })), ['accountId']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, accountId: id('d') })), ['accountId']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, currency: 'USD' })), ['currency']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, categoryId: id('2') })), ['categoryId']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, categoryId: id('3') })), ['categoryId']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, categoryId: id('9') })), ['categoryId']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, tagIds: [id('9')] })), ['tagIds']);
  assert.deepEqual(await issuePaths(service.create({ ...expense, date: '2026-10-11' })), ['date']);
});

test('every broken rule is reported at once', async () => {
  const { service } = setup();
  const paths = await issuePaths(
    service.create({
      ...expense,
      date: '2027-01-01',
      currency: 'USD',
      categoryId: id('2'),
      tagIds: [id('9')],
    }),
  );
  assert.deepEqual(paths, ['categoryId', 'currency', 'date', 'tagIds']);
});

test('transfers between currencies need both amounts, same-currency ones only one', async () => {
  const { service } = setup();
  const transfer: TransactionCreate = {
    ...expense,
    type: 'transfer',
    categoryId: null,
    tagIds: [],
    toAccountId: id('b'),
  };
  assert.equal((await service.create(transfer)).toAccountId, id('b'));
  assert.deepEqual(await issuePaths(service.create({ ...transfer, toAmountCents: 100 })), ['toAmountCents']);
  assert.deepEqual(await issuePaths(service.create({ ...transfer, toAccountId: id('c') })), [
    'toAmountCents',
  ]);
  assert.equal(
    (await service.create({ ...transfer, toAccountId: id('c'), toAmountCents: 100 })).toAmountCents,
    100,
  );
  assert.deepEqual(await issuePaths(service.create({ ...transfer, toAccountId: id('f') })), ['toAccountId']);
});

test('split categories are validated one by one', async () => {
  const { service } = setup();
  const splits = [
    { categoryId: id('1'), amountCents: 100000 },
    { categoryId: id('2'), amountCents: 50000 },
  ];
  assert.deepEqual(await issuePaths(service.create({ ...expense, categoryId: null, splits })), [
    'splits.1.categoryId',
  ]);
});

test('an update merges, re-validates and keeps what it was not asked to change', async () => {
  const { service } = setup();
  const created = await service.create({ ...expense, accountId: id('b'), paymentDate: '2026-11-10' });

  const renamed = await service.update(created.id, { description: 'Supermercado' });
  assert.equal(renamed.description, 'Supermercado');
  assert.equal(renamed.paymentDate, '2026-11-10');
  assert.equal(renamed.amountCents, 150000);
  assert.equal(renamed.edited, false);

  // Changing the date recalculates the payment date instead of keeping a stale one.
  const moved = await service.update(created.id, { date: '2026-10-08' });
  assert.equal(moved.paymentDate, '2026-10-08');

  assert.deepEqual(await issuePaths(service.update(created.id, { type: 'income' })), ['categoryId']);
  assert.deepEqual(await issuePaths(service.update(created.id, { type: 'transfer' })), [
    'categoryId',
    'toAccountId',
  ]);
  await assert.rejects(service.update(id('0'), { note: 'x' }), NotFoundError);
});

test('an archived category already on a transaction may stay on it', async () => {
  const { service, stored } = setup();
  const created = await service.create(expense);
  stored.set(created.id, { ...created, categoryId: id('3') });
  const updated = await service.update(created.id, { note: 'sigue igual' });
  assert.equal(updated.categoryId, id('3'));
});

test('imported transactions are marked edited once changed by hand', async () => {
  const { service, stored } = setup();
  await service.createMany(
    [{ input: expense, installment: { planId: null, number: 3, total: 6 } }],
    'import',
    {},
  );
  const [imported] = [...stored.values()];
  assert.ok(imported);
  assert.equal(imported.source, 'import');
  assert.deepEqual(imported.installment, { planId: null, number: 3, total: 6 });
  const updated = await service.update(imported.id, { note: 'corregido' });
  assert.equal(updated.edited, true);
  assert.deepEqual(updated.installment, { planId: null, number: 3, total: 6 });
});

test('a bulk insert stores nothing when one row is invalid, and says which', async () => {
  const { service, stored } = setup();
  await assert.rejects(
    service.createMany(
      [
        { input: expense, installment: null },
        { input: { ...expense, accountId: id('f') }, installment: null },
      ],
      'import',
      {},
    ),
    (error: unknown) => error instanceof ValidationError && (error.details as { index: number }).index === 1,
  );
  assert.equal(stored.size, 0);
});

test('trash: delete, restore, and neither twice', async () => {
  const { service } = setup();
  const created = await service.create(expense);
  await service.remove(created.id);
  await assert.rejects(service.remove(created.id), NotFoundError);
  await assert.rejects(service.update(created.id, { note: 'x' }), NotFoundError);
  assert.equal((await service.restore(created.id)).deletedAt, null);
  await assert.rejects(service.restore(created.id), NotFoundError);
});

test('products can be added, changed and removed by hand; transfers have none', async () => {
  const { service } = setup();
  const milk = { name: 'Leche', amountCents: 120000, product: 'Leche', group: 'dairy' as const, quantity: 2, productId: null, categoryId: null };
  const bread = { name: 'Pan', amountCents: 30000, product: 'Pan', group: 'bakery' as const, quantity: null, productId: null, categoryId: null };

  // They need not add up to the total: a receipt has discounts and lines that are not products.
  const created = await service.create({ ...expense, items: [milk, bread] });
  assert.deepEqual(created.items, [milk, bread]);

  const changed = await service.update(created.id, { items: [{ ...milk, amountCents: 110000 }] });
  assert.deepEqual(changed.items, [{ ...milk, amountCents: 110000 }]);
  // Editing something else keeps them.
  assert.equal((await service.update(created.id, { note: 'súper' })).items.length, 1);
  assert.deepEqual((await service.update(created.id, { items: [] })).items, []);

  await assert.rejects(
    service.create({
      ...expense,
      type: 'transfer',
      categoryId: null,
      tagIds: [],
      toAccountId: id('b'),
      items: [milk],
    }),
    (error: unknown) =>
      error instanceof ValidationError &&
      JSON.stringify(error.details).includes('A transfer cannot have products'),
  );
});
