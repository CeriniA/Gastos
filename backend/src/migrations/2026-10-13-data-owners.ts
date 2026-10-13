import mongoose from 'mongoose';
import { OWNER_FIELD, ownedModels } from '../core/db/ownerPlugin';
import type { Migration } from '../core/db/migrations';
import { UserModel } from '../modules/users/users.model';

/** Where "sign out everywhere" was remembered while the app had a single user. */
const LEGACY_AUTH_STATE = 'authState';

/**
 * The app had one user and its data had no owner. Everything stored so far
 * becomes the first admin's (created at startup from AUTH_USERNAME), and the
 * indexes are rebuilt: what was unique in the whole app is now unique per user.
 */
export const dataOwners: Migration = {
  id: '2026-10-13-data-owners',
  system: true,
  async up() {
    const first = await UserModel.findOne({ role: 'admin' }).sort({ createdAt: 1 }).lean();
    if (!first) throw new Error('There is no admin to own the existing data');
    for (const owned of ownedModels()) {
      await owned.updateMany({ [OWNER_FIELD]: { $exists: false } }, { $set: { [OWNER_FIELD]: first._id } });
      await owned.syncIndexes();
    }
    const collections = await mongoose.connection.listCollections();
    if (collections.some((collection) => collection.name === LEGACY_AUTH_STATE)) {
      await mongoose.connection.dropCollection(LEGACY_AUTH_STATE);
    }
  },
};
