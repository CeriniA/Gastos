import {
  API_PREFIX,
  CURRENCIES,
  DEFAULT_CURRENCY,
  RECURRING_MIN_MONTHS,
  addDays,
  addMonths,
  parseAmountToCents,
  todayIso,
  transactionCreateSchema,
} from '@gastos/shared';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsUser } from '../core/context/owner';
import { DRIVE_CALLBACK_ROUTE } from '../modules/backup/backup.routes';
import type { BackupStoreProvider } from '../providers/drive/googleDrive';
import { createMemoryContainer } from '../testing/memoryApp';
import { DEMO_STATEMENT_PAGES, demoReading } from './demoReading';

/**
 * The whole app with made-up data kept in memory, to try the screens without
 * touching the real database: nothing is saved, and stopping it forgets it all.
 * The AI, the PDF reader and Google Drive are pretend ones: every upload
 * "reads" the same invented answer (demoReading.ts) and connecting a Drive
 * succeeds at once. The first user (an admin) and their password are in
 * backend/memory.env; more users can be created from the app.
 * Usage: npm run demo (and, in another terminal, npm run dev:frontend)
 */

/** A Google that says yes: its consent page is our own callback, and copies stay in memory. */
function pretendDrive(): BackupStoreProvider {
  const callback = `http://localhost:${env.PORT}${API_PREFIX}${DRIVE_CALLBACK_ROUTE}`;
  const savedAt = new Map<string, Date>();
  return {
    consentUrl: (ticket) => `${callback}?${new URLSearchParams({ code: 'demo', state: ticket }).toString()}`,
    redeem: async () => `demo-${savedAt.size}`,
    open: (permission) => ({
      lastSavedAt: async () => savedAt.get(permission) ?? null,
      save: async () => {
        savedAt.set(permission, new Date());
      },
    }),
  };
}

const today = todayIso(env.APP_TIMEZONE);
const { container, backend } = createMemoryContainer(env, today, {
  read: demoReading,
  readInBackground: true,
  driveProvider: pretendDrive(),
});
backend.pdf.pages = DEMO_STATEMENT_PAGES;
const { accounts, categories, institutions, tags, transactions, users } = container;

const admin = await users.ensureFirst({ username: env.AUTH_USERNAME, passwordHash: env.AUTH_PASSWORD_HASH });
if (!admin) throw new Error('The demo starts empty: there cannot be a user yet');
await container.welcome(admin);

/** A few recent movements, one per day back from today, so no screen starts empty. */
const SAMPLES = [
  { type: 'expense', amount: '12500', category: 'Transporte', description: 'Nafta' },
  { type: 'expense', amount: '42000', category: 'Supermercado y alimentos', description: 'Super' },
  { type: 'expense', amount: '85400,50', category: 'Servicios', description: 'Luz' },
  { type: 'income', amount: '1500000', category: 'Sueldo', description: 'Sueldo' },
] as const;

await runAsUser(admin.id, async () => {
  const idByName = async (list: Promise<{ id: string; name: string }[]>) =>
    new Map((await list).map((entry) => [entry.name, entry.id]));
  const categoryIds = await idByName(categories.list());
  const accountIds = await idByName(accounts.list());
  const [bank] = (await institutions.list()).filter((institution) => institution.kind === 'bank');
  const [network] = (await institutions.list()).filter((institution) => institution.kind === 'network');

  // One card with a balance in each currency, to try statements and installments.
  for (const currency of CURRENCIES) {
    await accounts.create({
      name: currency === DEFAULT_CURRENCY ? 'Visa' : `Visa ${currency}`,
      type: 'credit_card',
      currency,
      bankId: bank?.id,
      networkId: network?.id,
    });
  }
  const tag = await tags.create({ name: 'Demo' });
  for (const [daysAgo, sample] of SAMPLES.entries()) {
    await transactions.create(
      transactionCreateSchema.parse({
        type: sample.type,
        date: addDays(today, -daysAgo),
        amountCents: parseAmountToCents(sample.amount),
        currency: DEFAULT_CURRENCY,
        accountId: accountIds.get('MercadoPago'),
        categoryId: categoryIds.get(sample.category),
        description: sample.description,
        tagIds: sample.type === 'expense' ? [tag.id] : [],
      }),
    );
  }
  // The same rent in each of the last months, so there is a fixed item to suggest.
  for (let monthsAgo = 1; monthsAgo <= RECURRING_MIN_MONTHS; monthsAgo += 1) {
    await transactions.create(
      transactionCreateSchema.parse({
        type: 'expense',
        date: addMonths(today, -monthsAgo),
        amountCents: parseAmountToCents('350000'),
        currency: DEFAULT_CURRENCY,
        accountId: accountIds.get('MercadoPago'),
        categoryId: categoryIds.get('Vivienda'),
        description: 'Alquiler',
      }),
    );
  }
});

createApp(container, env).listen(env.PORT, () => {
  console.log(`Demo en memoria: http://localhost:${env.PORT} (usuario "${env.AUTH_USERNAME}")`);
});
