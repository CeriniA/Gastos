import type { Migration } from '../core/db/migrations';
import { AccountModel } from '../modules/accounts/accounts.model';

/** Accounts stored before balances existed have no opening balance: they count from zero. */
export const accountOpeningBalance: Migration = {
  id: '2026-10-17-account-opening-balance',
  async up() {
    await AccountModel.updateMany({ openingBalance: { $exists: false } }, { $set: { openingBalance: null } });
  },
};
