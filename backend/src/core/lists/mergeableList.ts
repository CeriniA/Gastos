import { MAX_ALIASES_PER_ITEM, cleanAliases, nameKey, type Aliased } from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../db/transaction';
import { ConflictError, InUseError, NotFoundError, fieldError } from '../errors/errors';

/** What is written when an item of a list with known texts changes; the list adds its own fields. */
interface AliasedWrite {
  name: string;
  nameKey: string;
  aliases: string[];
  aliasKeys: string[];
  archived: boolean;
}

interface MergeableListOptions<Item extends Aliased & { archived: boolean }, Write extends AliasedWrite> {
  /** Name of the list, for errors: "Merchant", "Product". */
  entity: string;
  repository: {
    findAll(): Promise<Item[]>;
    delete(id: string, options?: WriteOptions): Promise<void>;
    update(id: string, data: Write, options?: WriteOptions): Promise<Item | null>;
  };
  /** How many transactions point at an item: it cannot be deleted while any does. */
  countTransactions(id: string): Promise<number>;
  /** Everything that pointed at one item points at another. */
  moveTransactions(fromId: string, toId: string, options: WriteOptions): Promise<void>;
  runInTransaction: TransactionRunner;
  /** The fields of an item that are its own and stay as they were when it absorbs another. */
  ownFields(item: Item): Omit<Write, keyof AliasedWrite>;
}

/**
 * Deleting and merging, the same for every list of items with known texts (merchants,
 * products): only an unused item is deleted; a used one is merged into another, which
 * takes over what pointed at it and learns its name and known texts.
 */
export function createMergeableList<Item extends Aliased & { archived: boolean }, Write extends AliasedWrite>(
  options: MergeableListOptions<Item, Write>,
) {
  const { entity, repository } = options;

  async function find(id: string): Promise<Item> {
    const item = (await repository.findAll()).find((candidate) => candidate.id === id);
    if (!item) throw new NotFoundError(entity, id);
    return item;
  }

  return {
    async remove(id: string): Promise<void> {
      await find(id);
      const used = await options.countTransactions(id);
      if (used > 0) throw new InUseError(entity, 'transactions', used);
      await repository.delete(id);
    },

    async merge(sourceId: string, targetId: string): Promise<Item> {
      const source = await find(sourceId);
      const target = await find(targetId);
      if (source.id === target.id) throw fieldError('targetId', 'Choose a different item to merge into');
      const aliases = cleanAliases(target.name, [...target.aliases, source.name, ...source.aliases]);
      if (aliases.length > MAX_ALIASES_PER_ITEM) {
        throw new ConflictError('The result would have too many known texts', { entity });
      }
      return options.runInTransaction(async (session) => {
        await options.moveTransactions(source.id, target.id, { session });
        // The source goes first: its texts cannot be on two items at once.
        await repository.delete(source.id, { session });
        const merged = await repository.update(
          target.id,
          {
            ...(options.ownFields(target) as object),
            name: target.name,
            nameKey: nameKey(target.name),
            aliases,
            aliasKeys: aliases.map(nameKey),
            archived: target.archived,
          } as Write,
          { session },
        );
        if (!merged) throw new NotFoundError(entity, target.id);
        return merged;
      });
    },
  };
}
