import { nameKey, type Account, type AccountCreate, type AccountUpdate } from '@gastos/shared';
import { DuplicateError, InUseError, NotFoundError } from '../../core/errors/errors';
import type { AccountsRepository } from './accounts.repository';

export interface AccountUsage {
  /** Transactions (including the trash) that use the account as origin or destination. */
  countTransactions(accountId: string): Promise<number>;
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

  return {
    list: () => repository.findAll(),
    get,

    async create(input: AccountCreate): Promise<Account> {
      await assertNameFree(input.name);
      return repository.create({ ...input, nameKey: nameKey(input.name) });
    },

    async update(id: string, input: AccountUpdate): Promise<Account> {
      await get(id);
      if (input.name !== undefined) await assertNameFree(input.name, id);
      const updated = await repository.update(id, {
        ...(input.name !== undefined ? { name: input.name, nameKey: nameKey(input.name) } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      });
      if (!updated) throw new NotFoundError('Account', id);
      return updated;
    },

    /** An account with history can only be archived, never deleted. */
    async remove(id: string): Promise<void> {
      await get(id);
      const count = await usage.countTransactions(id);
      if (count > 0) throw new InUseError('Account', 'transactions', count);
      await repository.delete(id);
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
