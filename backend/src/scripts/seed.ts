import { nameKey, type CategoryKind } from '@gastos/shared';
import { createContainer } from '../composition';
import { env } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../core/db/connection';
import { SEED_ACCOUNTS, SEED_CATEGORIES } from './seedData';

/**
 * Loads the starting categories and accounts. Safe to run more than once:
 * anything that already exists is left alone.
 * Usage: npm run seed -w backend
 */

await connectDatabase(env.MONGODB_URI);
const { accounts, categories } = createContainer(env);

const existingCategories = await categories.list();
for (const kind of Object.keys(SEED_CATEGORIES) as CategoryKind[]) {
  for (const name of SEED_CATEGORIES[kind]) {
    const exists = existingCategories.some(
      (category) =>
        category.kind === kind && category.parentId === null && nameKey(category.name) === nameKey(name),
    );
    if (!exists) await categories.create({ name, kind, parentId: null });
  }
}

const existingAccounts = await accounts.list();
for (const account of SEED_ACCOUNTS) {
  if (!existingAccounts.some((existing) => nameKey(existing.name) === nameKey(account.name))) {
    await accounts.create(account);
  }
}

console.log(`Categories: ${(await categories.list()).length}, accounts: ${(await accounts.list()).length}`);
await disconnectDatabase();
