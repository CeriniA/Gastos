import { nameKey, type Tag, type TagInput } from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { DuplicateError, NotFoundError } from '../../core/errors/errors';
import type { TagsRepository } from './tags.repository';

export interface TagUsage {
  /** Takes the tag off every transaction that carries it. */
  removeTagEverywhere(tagId: string, options: WriteOptions): Promise<void>;
}

export function createTagsService(
  repository: TagsRepository,
  usage: TagUsage,
  runInTransaction: TransactionRunner,
) {
  async function get(id: string): Promise<Tag> {
    const tag = await repository.findById(id);
    if (!tag) throw new NotFoundError('Tag', id);
    return tag;
  }

  async function assertNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await repository.findByNameKey(nameKey(name));
    if (existing && existing.id !== exceptId) throw new DuplicateError('Tag', 'name');
  }

  return {
    list: (options: WriteOptions = {}) => repository.findAll(options),
    get,

    async create(input: TagInput, options: WriteOptions = {}): Promise<Tag> {
      await assertNameFree(input.name);
      return repository.create({ name: input.name, nameKey: nameKey(input.name) }, options);
    },

    async rename(id: string, input: TagInput): Promise<Tag> {
      await get(id);
      await assertNameFree(input.name, id);
      const updated = await repository.rename(id, { name: input.name, nameKey: nameKey(input.name) });
      if (!updated) throw new NotFoundError('Tag', id);
      return updated;
    },

    /** Deleting a tag also takes it off its transactions, in one transaction. */
    async remove(id: string): Promise<void> {
      await get(id);
      await runInTransaction(async (session) => {
        await usage.removeTagEverywhere(id, { session });
        await repository.delete(id, { session });
      });
    },

    /** Returns the tag for each name, creating the ones that do not exist. */
    async ensureByNames(
      names: readonly string[],
      options: WriteOptions,
    ): Promise<{ tags: Tag[]; created: number }> {
      const existing = new Map((await repository.findAll(options)).map((tag) => [nameKey(tag.name), tag]));
      const tags: Tag[] = [];
      let created = 0;
      for (const name of names) {
        let tag = existing.get(nameKey(name));
        if (!tag) {
          tag = await repository.create({ name: name.trim(), nameKey: nameKey(name) }, options);
          existing.set(nameKey(name), tag);
          created += 1;
        }
        tags.push(tag);
      }
      return { tags, created };
    },
  };
}

export type TagsService = ReturnType<typeof createTagsService>;
