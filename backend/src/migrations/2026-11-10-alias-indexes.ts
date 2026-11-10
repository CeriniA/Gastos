import type { Migration } from '../core/db/migrations';
import { MerchantModel } from '../modules/merchants/merchants.model';
import { ProductModel } from '../modules/products/products.model';

/**
 * The first version of the index of known texts was unique over every item,
 * and MongoDB indexes an empty list as one entry: a second merchant without
 * known texts was refused. Making the indexes match the models drops it and
 * leaves the one that only covers items that have known texts. It runs before
 * the migration that fills the lists.
 */
export const aliasIndexes: Migration = {
  id: '2026-11-10-alias-indexes',
  system: true,
  async up() {
    await MerchantModel.syncIndexes();
    await ProductModel.syncIndexes();
  },
};
