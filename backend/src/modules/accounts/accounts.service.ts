import {
  nameKey,
  type Account,
  type AccountCreate,
  type AccountType,
  type AccountUpdate,
  type Institution,
  type InstitutionKind,
} from '@gastos/shared';
import { DuplicateError, InUseError, NotFoundError, fieldError } from '../../core/errors/errors';
import type { AccountsRepository } from './accounts.repository';

export interface AccountUsage {
  /** Transactions (including the trash) that use the account as origin or destination. */
  countTransactions(accountId: string): Promise<number>;
  /** Card statements and installment plans recorded for the account. */
  countCardPeriods(accountId: string): Promise<number>;
  /** The bank or card brand with that id, or null. */
  findInstitution(institutionId: string): Promise<Institution | null>;
}

export function createAccountsService(repository: AccountsRepository, usage: AccountUsage) {
  async function get(id: string): Promise<Account> {
    const account = await repository.findById(id);
    if (!account) throw new NotFoundError('Account', id);
    return account;
  }

  async function assertNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await repository.findByNameKey(nameKey(name));
    if (existing && existing.id !== exceptId) throw new DuplicateError('Account', 'name');
  }

  /**
   * A bank or brand must exist, be of the right kind and be active, unless the
   * account already had it. Only credit cards have a brand.
   */
  async function checkInstitution(
    field: 'bankId' | 'networkId',
    kind: InstitutionKind,
    id: string | null,
    previous: string | null,
  ): Promise<void> {
    if (id === null || id === previous) return;
    const institution = await usage.findInstitution(id);
    if (!institution || institution.kind !== kind) throw fieldError(field, 'Institution does not exist');
    if (institution.archived) throw fieldError(field, 'Institution is archived');
  }

  async function checkInstitutions(
    type: AccountType,
    next: { bankId: string | null; networkId: string | null },
    previous: { bankId: string | null; networkId: string | null } = { bankId: null, networkId: null },
  ): Promise<void> {
    if (next.networkId !== null && type !== 'credit_card') {
      throw fieldError('networkId', 'Only credit cards have a card brand');
    }
    await checkInstitution('bankId', 'bank', next.bankId, previous.bankId);
    await checkInstitution('networkId', 'network', next.networkId, previous.networkId);
  }

  return {
    list: () => repository.findAll(),
    get,
    countByInstitution: (institutionId: string) => repository.countByInstitution(institutionId),

    /** Bank and brand may be left out: most accounts are created without them. */
    async create(
      input: Omit<AccountCreate, 'bankId' | 'networkId'> &
        Partial<Pick<AccountCreate, 'bankId' | 'networkId'>>,
    ): Promise<Account> {
      const data = { ...input, bankId: input.bankId ?? null, networkId: input.networkId ?? null };
      await assertNameFree(data.name);
      await checkInstitutions(data.type, data);
      return repository.create({ ...data, nameKey: nameKey(data.name) });
    },

    async update(id: string, input: AccountUpdate): Promise<Account> {
      const current = await get(id);
      if (input.name !== undefined) await assertNameFree(input.name, id);
      await checkInstitutions(
        current.type,
        {
          bankId: input.bankId === undefined ? current.bankId : input.bankId,
          networkId: input.networkId === undefined ? current.networkId : input.networkId,
        },
        current,
      );
      const updated = await repository.update(id, {
        ...(input.name !== undefined ? { name: input.name, nameKey: nameKey(input.name) } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
        ...(input.bankId !== undefined ? { bankId: input.bankId } : {}),
        ...(input.networkId !== undefined ? { networkId: input.networkId } : {}),
      });
      if (!updated) throw new NotFoundError('Account', id);
      return updated;
    },

    /** An account with history can only be archived, never deleted. */
    async remove(id: string): Promise<void> {
      await get(id);
      const count = await usage.countTransactions(id);
      if (count > 0) throw new InUseError('Account', 'transactions', count);
      const periods = await usage.countCardPeriods(id);
      if (periods > 0) throw new InUseError('Account', 'cardPeriods', periods);
      await repository.delete(id);
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
