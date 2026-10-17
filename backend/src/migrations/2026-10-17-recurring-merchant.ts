import type { Migration } from '../core/db/migrations';
import { RecurringModel } from '../modules/recurrings/recurrings.model';

/**
 * Fixed items stored before they were recognised by their merchant: none was
 * ignored, and each is recognised by its own name until the user says otherwise.
 * The app had no screen for them yet, so there is normally nothing to change.
 */
export const recurringMerchant: Migration = {
  id: '2026-10-17-recurring-merchant',
  async up() {
    await RecurringModel.updateMany({ ignored: { $exists: false } }, { $set: { ignored: false } });
    const missing = await RecurringModel.find({ merchantKey: { $exists: false } }, { nameKey: 1 }).lean<
      { _id: unknown; nameKey: string }[]
    >();
    for (const doc of missing) {
      await RecurringModel.updateOne({ _id: doc._id }, { $set: { merchantKey: doc.nameKey } });
    }
  },
};
