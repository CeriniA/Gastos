import type { Merchant, Product } from '@gastos/shared';
import type { Migration } from '../core/db/migrations';
import { toObjectId } from '../core/db/ids';
import { MerchantModel } from '../modules/merchants/merchants.model';
import { ProductModel } from '../modules/products/products.model';
import { TransactionModel } from '../modules/transactions/transactions.model';
import { linksFor } from './backfillLists';

/** Transactions updated per request to the database. */
const BATCH_SIZE = 500;

const toLists = (docs: { _id: { toString(): string }; name: string; aliases: string[] }[]) =>
  docs.map((doc) => ({ id: doc._id.toString(), name: doc.name, aliases: doc.aliases }));

/**
 * Points each expense at the merchant its description names and each of its
 * lines at the product it names, using the lists the previous migration
 * filled. The description and the product text stay where they are: they go
 * away only when nothing reads them any more. What matches nothing is left as
 * it is, and what already points at a list is not touched, so it can run again.
 */
export const transactionsLists: Migration = {
  id: '2026-11-10-transactions-lists',
  async up() {
    const merchants = toLists(await MerchantModel.find().lean()) as unknown as Merchant[];
    const products = toLists(await ProductModel.find().lean()) as unknown as Product[];

    const operations: Parameters<typeof TransactionModel.bulkWrite>[0] = [];
    const flush = async () => {
      if (operations.length > 0) await TransactionModel.bulkWrite(operations.splice(0));
    };
    const cursor = TransactionModel.find(
      { type: 'expense' },
      { type: 1, description: 1, merchantId: 1, items: 1 },
    ).lean().cursor();
    for await (const doc of cursor) {
      const links = linksFor(
        {
          type: doc.type,
          description: doc.description ?? '',
          merchantId: doc.merchantId ? doc.merchantId.toString() : null,
          items: (doc.items ?? []).map((item) => ({
            product: item.product,
            productId: item.productId ? item.productId.toString() : null,
          })),
        },
        merchants,
        products,
      );
      const entries = Object.entries(links);
      if (entries.length === 0) continue;
      const $set = Object.fromEntries(entries.map(([path, id]) => [path, toObjectId(id)]));
      operations.push({ updateOne: { filter: { _id: doc._id }, update: { $set } } });
      if (operations.length >= BATCH_SIZE) await flush();
    }
    await flush();
  },
};
