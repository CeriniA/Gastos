import type { Migration } from '../core/db/migrations';
import { TransactionModel } from '../modules/transactions/transactions.model';

/** Transactions stored before refunds existed are not refunds. */
export const transactionRefund: Migration = {
  id: '2026-10-12-transaction-refund',
  async up() {
    await TransactionModel.updateMany({ refund: { $exists: false } }, { $set: { refund: false } });
  },
};
