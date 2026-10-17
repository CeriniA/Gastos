import type { Migration } from '../core/db/migrations';
import { UserModel } from '../modules/users/users.model';

/**
 * Users stored before the daily AI limit existed: no limit of their own (the
 * installation's applies) and nothing sent today. Users are nobody's data, so
 * this runs once for the whole database.
 */
export const userAiLimit: Migration = {
  id: '2026-10-17-user-ai-limit',
  system: true,
  async up() {
    await UserModel.updateMany({ aiDailyLimit: { $exists: false } }, { $set: { aiDailyLimit: null } });
    await UserModel.updateMany({ aiUsage: { $exists: false } }, { $set: { aiUsage: null } });
  },
};
