import type { Migration } from '../core/db/migrations';
import { RecurringModel } from '../modules/recurrings/recurrings.model';

/**
 * A fixed item's name used to be unique per user; now it is unique per user,
 * kind and currency (Netflix in pesos and in dollars). Creating the new index
 * does not drop the old one, which would keep refusing the second Netflix, so
 * the collection's indexes are made to match the model.
 */
export const recurringNameIndex: Migration = {
  id: '2026-10-17-recurring-name-index',
  system: true,
  async up() {
    await RecurringModel.syncIndexes();
  },
};
