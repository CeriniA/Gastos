import { nameKey, type CategoryKind } from '@gastos/shared';
import { createContainer } from '../composition';
import { env } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../core/db/connection';

/**
 * Loads the starting categories and accounts agreed in design. Safe to run
 * more than once: anything that already exists is left alone.
 * Usage: npm run seed -w backend
 *
 * Names are in Spanish because they are the user's data, not code.
 */
const CATEGORIES: Record<CategoryKind, string[]> = {
  expense: [
    'Supermercado y alimentos',
    'Vivienda',
    'Servicios',
    'Transporte',
    'Salud',
    'Comidas afuera y delivery',
    'Compras',
    'Suscripciones',
    'Educación',
    'Ocio y viajes',
    'Impuestos',
    'Cargos financieros',
    'Otros egresos',
  ],
  income: ['Sueldo', 'Trabajos independientes', 'Ventas', 'Rendimientos e intereses', 'Otros ingresos'],
};

const ACCOUNTS = [
  { name: 'Efectivo', type: 'cash', currency: 'ARS' },
  { name: 'Efectivo USD', type: 'cash', currency: 'USD' },
  { name: 'MercadoPago', type: 'wallet', currency: 'ARS' },
] as const;

await connectDatabase(env.MONGODB_URI);
const { accounts, categories } = createContainer(env);

const existingCategories = await categories.list();
for (const kind of Object.keys(CATEGORIES) as CategoryKind[]) {
  for (const name of CATEGORIES[kind]) {
    const exists = existingCategories.some(
      (category) =>
        category.kind === kind && category.parentId === null && nameKey(category.name) === nameKey(name),
    );
    if (!exists) await categories.create({ name, kind, parentId: null });
  }
}

const existingAccounts = await accounts.list();
for (const account of ACCOUNTS) {
  if (!existingAccounts.some((existing) => nameKey(existing.name) === nameKey(account.name))) {
    await accounts.create(account);
  }
}

console.log(`Categories: ${(await categories.list()).length}, accounts: ${(await accounts.list()).length}`);
await disconnectDatabase();
