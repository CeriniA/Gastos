import {
  DEFAULT_CURRENCY,
  DEFAULT_INSTITUTIONS,
  FINANCIAL_CHARGES_CATEGORY,
  FINANCIAL_CHARGES_ROLE,
  INSTITUTION_KINDS,
  type CategoryKind,
} from '@gastos/shared';
import type { Services } from './wiring';

/**
 * What every user starts with, as agreed in design. Names are in Spanish
 * because they are the user's data, not code; from there each one is theirs
 * to rename, archive or add to.
 */
export const STARTER_CATEGORIES: Record<CategoryKind, string[]> = {
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
    FINANCIAL_CHARGES_CATEGORY,
    'Otros egresos',
  ],
  income: ['Sueldo', 'Trabajos independientes', 'Ventas', 'Rendimientos e intereses', 'Otros ingresos'],
};

export const STARTER_ACCOUNTS = [
  { name: 'Efectivo', type: 'cash', currency: DEFAULT_CURRENCY },
  { name: 'Efectivo USD', type: 'cash', currency: 'USD' },
  { name: 'MercadoPago', type: 'wallet', currency: DEFAULT_CURRENCY },
] as const;

/**
 * Gives the running user their starting categories, accounts, banks and card
 * brands. Only when they have nothing: it never lands on top of somebody's data
 * (the first admin of an installation that already had some keeps what was there).
 */
export async function giveStarterData(
  services: Pick<Services, 'accounts' | 'categories' | 'institutions'>,
): Promise<void> {
  const { accounts, categories, institutions } = services;
  if ((await categories.list()).length > 0 || (await accounts.list()).length > 0) return;

  if ((await institutions.list()).length === 0) {
    for (const kind of INSTITUTION_KINDS) {
      for (const name of DEFAULT_INSTITUTIONS[kind]) await institutions.create({ name, kind });
    }
  }
  for (const kind of Object.keys(STARTER_CATEGORIES) as CategoryKind[]) {
    for (const name of STARTER_CATEGORIES[kind]) {
      const role = name === FINANCIAL_CHARGES_CATEGORY ? FINANCIAL_CHARGES_ROLE : null;
      await categories.create({ name, kind, parentId: null, role });
    }
  }
  for (const account of STARTER_ACCOUNTS) await accounts.create(account);
}
