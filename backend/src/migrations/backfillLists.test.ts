import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Merchant, Product } from '@gastos/shared';
import { linksFor, type TransactionText } from './backfillLists';

const stamp = '2026-10-01T00:00:00.000Z';
const merchant = (id: string, name: string, aliases: string[] = []): Merchant => ({
  id,
  name,
  aliases,
  defaultCategoryId: null,
  archived: false,
  createdAt: stamp,
  updatedAt: stamp,
});
const product = (id: string, name: string): Product => ({
  id,
  name,
  aliases: [],
  categoryId: 'c',
  archived: false,
  createdAt: stamp,
  updatedAt: stamp,
});

const merchants = [merchant('m1', 'Café Martínez', ['CAFE MTZ'])];
const products = [product('p1', 'Yerba'), product('p2', 'Leche')];

const expense = (overrides: Partial<TransactionText>): TransactionText => ({
  type: 'expense',
  description: '',
  merchantId: null,
  items: [],
  ...overrides,
});

test('an expense is linked to the merchant and the products its words name', () => {
  const links = linksFor(
    expense({ description: 'cafe martinez', items: [{ product: 'yerba' }, { product: '' }, { product: 'LECHE' }] }),
    merchants,
    products,
  );
  assert.deepEqual(links, { merchantId: 'm1', 'items.0.productId': 'p1', 'items.2.productId': 'p2' });
});

test('a known text of the merchant also finds it', () => {
  assert.deepEqual(linksFor(expense({ description: 'Cafe Mtz' }), merchants, products), { merchantId: 'm1' });
});

test('what already points at a list, or matches nothing, or is not an expense, is left alone', () => {
  assert.deepEqual(linksFor(expense({ description: 'Café Martínez', merchantId: 'x' }), merchants, products), {});
  assert.deepEqual(linksFor(expense({ description: 'Otro' }), merchants, products), {});
  assert.deepEqual(
    linksFor(expense({ items: [{ product: 'Yerba', productId: 'p9' }] }), merchants, products),
    {},
  );
  assert.deepEqual(linksFor(expense({ type: 'income', description: 'Café Martínez' }), merchants, products), {});
});
