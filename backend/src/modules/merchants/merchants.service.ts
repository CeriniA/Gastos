import {
  cleanAliases,
  findByPrintedText,
  nameKey,
  type Category,
  type Merchant,
  type MerchantCreate,
  type MerchantUpdate,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { createMergeableList } from '../../core/lists/mergeableList';
import { DuplicateError, NotFoundError, fieldError } from '../../core/errors/errors';
import type { MerchantsRepository } from './merchants.repository';

export interface MerchantsDependencies {
  listCategories(options?: WriteOptions): Promise<Category[]>;
  /** How many transactions point at one merchant: it cannot be deleted while any does. */
  countTransactions(merchantId: string): Promise<number>;
  /** Everything that pointed at one merchant points at another. */
  moveTransactions(fromId: string, toId: string, options: WriteOptions): Promise<void>;
}

export function createMerchantsService(
  repository: MerchantsRepository,
  dependencies: MerchantsDependencies,
  runInTransaction: TransactionRunner,
) {
  async function assertCategory(categoryId: string | null): Promise<void> {
    if (categoryId === null) return;
    const category = (await dependencies.listCategories()).find((candidate) => candidate.id === categoryId);
    if (!category) throw fieldError('defaultCategoryId', 'The category does not exist');
    if (category.kind !== 'expense') throw fieldError('defaultCategoryId', 'Choose an expense category');
  }

  /** A name or a known text can point at one merchant only. */
  function assertTextsFree(merchants: readonly Merchant[], name: string, aliases: readonly string[], exceptId?: string) {
    if (findByPrintedText(merchants, name, exceptId)) throw new DuplicateError('Merchant', 'name');
    for (const alias of aliases) {
      if (findByPrintedText(merchants, alias, exceptId)) throw new DuplicateError('Merchant', 'aliases');
    }
  }

  const mergeable = createMergeableList({
    entity: 'Merchant',
    repository,
    countTransactions: dependencies.countTransactions,
    moveTransactions: dependencies.moveTransactions,
    runInTransaction,
    ownFields: (merchant) => ({ defaultCategoryId: merchant.defaultCategoryId }),
  });

  return {
    list: (options: WriteOptions = {}) => repository.findAll(options),

    /** The merchant a printed text belongs to: by its name or by a known text. */
    async findByText(text: string): Promise<Merchant | null> {
      return findByPrintedText(await repository.findAll(), text) ?? null;
    },

    async create(input: MerchantCreate, options: WriteOptions = {}): Promise<Merchant> {
      const aliases = cleanAliases(input.name, input.aliases);
      assertTextsFree(await repository.findAll(options), input.name, aliases);
      await assertCategory(input.defaultCategoryId);
      return repository.create(
        {
          name: input.name,
          nameKey: nameKey(input.name),
          defaultCategoryId: input.defaultCategoryId,
          aliases,
          aliasKeys: aliases.map(nameKey),
        },
        options,
      );
    },

    async update(id: string, input: MerchantUpdate): Promise<Merchant> {
      const merchants = await repository.findAll();
      const current = merchants.find((merchant) => merchant.id === id);
      if (!current) throw new NotFoundError('Merchant', id);

      const name = input.name ?? current.name;
      const aliases = cleanAliases(name, input.aliases ?? current.aliases);
      const defaultCategoryId =
        input.defaultCategoryId === undefined ? current.defaultCategoryId : input.defaultCategoryId;
      assertTextsFree(merchants, name, aliases, id);
      if (defaultCategoryId !== current.defaultCategoryId) await assertCategory(defaultCategoryId);

      const updated = await repository.update(id, {
        name,
        nameKey: nameKey(name),
        defaultCategoryId,
        aliases,
        aliasKeys: aliases.map(nameKey),
        archived: input.archived ?? current.archived,
      });
      if (!updated) throw new NotFoundError('Merchant', id);
      return updated;
    },

    ...mergeable,

    /** A category merged into another: the merchants that suggested it now suggest the other. */
    moveCategory: repository.moveCategory,
    /** A category deleted: its merchants stay, without a suggested one. */
    clearCategory: repository.clearCategory,
  };
}

export type MerchantsService = ReturnType<typeof createMerchantsService>;
