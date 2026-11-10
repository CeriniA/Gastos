import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MerchantModel } from '../../modules/merchants/merchants.model';
import { ProductModel } from '../../modules/products/products.model';
import { ALIAS_INDEX_NAME } from './aliasIndex';

test('the index of known texts only covers items that have some, because an empty list is indexed too', () => {
  for (const model of [MerchantModel, ProductModel]) {
    const index = model.schema.indexes().find(([, options]) => options?.name === ALIAS_INDEX_NAME);
    assert.ok(index, 'the index exists');
    assert.equal(index[1]?.unique, true);
    assert.deepEqual(index[1]?.partialFilterExpression, { 'aliasKeys.0': { $exists: true } });
  }
});
