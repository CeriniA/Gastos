import { DEFAULT_INSTITUTIONS, INSTITUTION_KINDS, nameKey } from '@gastos/shared';
import type { Migration } from '../core/db/migrations';
import { InstitutionModel } from '../modules/institutions/institutions.model';

/** Starts the bank and card brand lists with the common ones, once. */
export const defaultInstitutions: Migration = {
  id: '2026-10-12-default-institutions',
  async up() {
    if ((await InstitutionModel.countDocuments()) > 0) return;
    await InstitutionModel.insertMany(
      INSTITUTION_KINDS.flatMap((kind) =>
        DEFAULT_INSTITUTIONS[kind].map((name) => ({ name, nameKey: nameKey(name), kind })),
      ),
    );
  },
};
