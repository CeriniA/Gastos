import { FINANCIAL_CHARGES_CATEGORY, FINANCIAL_CHARGES_ROLE, nameKey } from '@gastos/shared';
import type { Migration } from '../core/db/migrations';
import { CategoryModel } from '../modules/categories/categories.model';

/**
 * Categories stored before they could carry a role: every one has none, except
 * the expense category the app used to find by its name ("Cargos financieros"),
 * which now is the one with the role `financial_charges`.
 */
export const categoryRole: Migration = {
  id: '2026-11-10-category-role',
  async up() {
    await CategoryModel.updateMany({ role: { $exists: false } }, { $set: { role: null } });
    await CategoryModel.updateOne(
      { kind: 'expense', archived: false, nameKey: nameKey(FINANCIAL_CHARGES_CATEGORY), role: null },
      { $set: { role: FINANCIAL_CHARGES_ROLE } },
    );
  },
};
