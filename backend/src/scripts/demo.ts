import {
  DEFAULT_INSTITUTIONS,
  INSTITUTION_KINDS,
  addDays,
  parseAmountToCents,
  todayIso,
  transactionCreateSchema,
  type CategoryKind,
} from '@gastos/shared';
import { createApp } from '../app';
import { env } from '../config/env';
import { createMemoryContainer } from '../testing/memoryApp';
import { SEED_ACCOUNTS, SEED_CATEGORIES } from './seedData';

/**
 * The whole app with made-up data kept in memory, to try the screens without
 * touching the real database: nothing is saved, and stopping it forgets it all.
 * The AI reads nothing here. The user and password are in backend/memory.env.
 * Usage: npm run demo (and, in another terminal, npm run dev:frontend)
 */

const today = todayIso(env.APP_TIMEZONE);
const { container } = createMemoryContainer(env, today);
const { accounts, categories, institutions, tags, transactions } = container;

for (const kind of INSTITUTION_KINDS) {
  for (const name of DEFAULT_INSTITUTIONS[kind]) await institutions.create({ name, kind });
}
const categoryIds = new Map<string, string>();
for (const kind of Object.keys(SEED_CATEGORIES) as CategoryKind[]) {
  for (const name of SEED_CATEGORIES[kind]) {
    categoryIds.set(name, (await categories.create({ name, kind, parentId: null })).id);
  }
}
const accountIds = new Map<string, string>();
for (const account of SEED_ACCOUNTS) accountIds.set(account.name, (await accounts.create(account)).id);
const tag = await tags.create({ name: 'Demo' });

/** A few recent movements, one per day back from today, so no screen starts empty. */
const SAMPLES = [
  { type: 'expense', amount: '12500', category: 'Transporte', description: 'Nafta' },
  { type: 'expense', amount: '42000', category: 'Supermercado y alimentos', description: 'Super' },
  { type: 'expense', amount: '85400,50', category: 'Servicios', description: 'Luz' },
  { type: 'income', amount: '1500000', category: 'Sueldo', description: 'Sueldo' },
] as const;
for (const [daysAgo, sample] of SAMPLES.entries()) {
  await transactions.create(
    transactionCreateSchema.parse({
      type: sample.type,
      date: addDays(today, -daysAgo),
      amountCents: parseAmountToCents(sample.amount),
      currency: 'ARS',
      accountId: accountIds.get('MercadoPago'),
      categoryId: categoryIds.get(sample.category),
      description: sample.description,
      tagIds: sample.type === 'expense' ? [tag.id] : [],
    }),
  );
}

createApp(container, env).listen(env.PORT, () => {
  console.log(`Demo en memoria: http://localhost:${env.PORT} (usuario "${env.AUTH_USERNAME}")`);
});
