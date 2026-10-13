import { FINANCIAL_CHARGES_CATEGORY, type CategoryKind } from '@gastos/shared';

/**
 * The starting categories and accounts agreed in design. Names are in Spanish
 * because they are the user's data, not code.
 */
export const SEED_CATEGORIES: Record<CategoryKind, string[]> = {
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

export const SEED_ACCOUNTS = [
  { name: 'Efectivo', type: 'cash', currency: 'ARS' },
  { name: 'Efectivo USD', type: 'cash', currency: 'USD' },
  { name: 'MercadoPago', type: 'wallet', currency: 'ARS' },
] as const;
