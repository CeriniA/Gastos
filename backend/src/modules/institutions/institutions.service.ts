import { nameKey, type Institution, type InstitutionCreate, type InstitutionUpdate } from '@gastos/shared';
import { DuplicateError, InUseError, NotFoundError } from '../../core/errors/errors';
import type { InstitutionsRepository } from './institutions.repository';

export interface InstitutionUsage {
  /** Accounts tied to the institution, as bank or as card brand. */
  countAccounts(institutionId: string): Promise<number>;
}

/** Banks and card brands: a short list the user keeps, to tell cards and accounts apart. */
export function createInstitutionsService(repository: InstitutionsRepository, usage: InstitutionUsage) {
  async function get(id: string): Promise<Institution> {
    const institution = await repository.findById(id);
    if (!institution) throw new NotFoundError('Institution', id);
    return institution;
  }

  async function assertNameFree(institution: Pick<Institution, 'kind' | 'name'>, exceptId?: string) {
    const existing = await repository.findByNameKey(institution.kind, nameKey(institution.name));
    if (existing && existing.id !== exceptId) throw new DuplicateError('Institution', 'name');
  }

  return {
    list: () => repository.findAll(),
    get,
    /** For other modules: the institution, or null when it does not exist. */
    find: (id: string) => repository.findById(id),

    async create(input: InstitutionCreate): Promise<Institution> {
      await assertNameFree(input);
      return repository.create({ ...input, nameKey: nameKey(input.name) });
    },

    async update(id: string, input: InstitutionUpdate): Promise<Institution> {
      const current = await get(id);
      if (input.name !== undefined) await assertNameFree({ kind: current.kind, name: input.name }, id);
      const updated = await repository.update(id, {
        ...(input.name !== undefined ? { name: input.name, nameKey: nameKey(input.name) } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      });
      if (!updated) throw new NotFoundError('Institution', id);
      return updated;
    },

    /** One in use can only be archived, so the accounts keep showing it. */
    async remove(id: string): Promise<void> {
      await get(id);
      const count = await usage.countAccounts(id);
      if (count > 0) throw new InUseError('Institution', 'accounts', count);
      await repository.delete(id);
    },
  };
}

export type InstitutionsService = ReturnType<typeof createInstitutionsService>;
