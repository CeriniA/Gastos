import { nameKey, type Category, type CategoryRule, type CategoryRuleInput } from '@gastos/shared';
import type { WriteOptions } from '../../core/db/transaction';
import { NotFoundError, fieldError } from '../../core/errors/errors';
import type { CategoryRulesRepository, StoredRule } from './categoryRules.repository';

export interface CategoryRuleDependencies {
  listCategories(options?: WriteOptions): Promise<Category[]>;
}

function toPublic(rule: StoredRule): CategoryRule {
  const { merchantKey: _merchantKey, ...rest } = rule;
  return rest;
}

/**
 * "This merchant always goes to this category." Rules are created when the
 * user corrects a suggestion and agrees to remember it, and they win over
 * whatever the AI suggests.
 */
export function createCategoryRulesService(
  repository: CategoryRulesRepository,
  deps: CategoryRuleDependencies,
) {
  return {
    async list(): Promise<CategoryRule[]> {
      return (await repository.findAll()).map(toPublic);
    },

    /** Category id for each known merchant, keyed by the normalised merchant name. */
    async lookup(options: WriteOptions = {}): Promise<Map<string, string>> {
      const rules = await repository.findAll(options);
      return new Map(rules.map((rule) => [rule.merchantKey, rule.categoryId]));
    },

    async save(input: CategoryRuleInput, options: WriteOptions = {}): Promise<CategoryRule> {
      const category = (await deps.listCategories(options)).find(
        (candidate) => candidate.id === input.categoryId,
      );
      if (!category) throw fieldError('categoryId', 'Category does not exist');
      if (category.archived) throw fieldError('categoryId', 'Category is archived');
      const rule = await repository.upsert(
        { merchant: input.merchant, merchantKey: nameKey(input.merchant), categoryId: input.categoryId },
        options,
      );
      return toPublic(rule);
    },

    async remove(id: string): Promise<void> {
      if (!(await repository.delete(id))) throw new NotFoundError('CategoryRule', id);
    },

    // What the categories module may ask.
    removeByCategory: (categoryId: string, options: WriteOptions) =>
      repository.deleteByCategory(categoryId, options),
    moveCategory: (fromId: string, toId: string, options: WriteOptions) =>
      repository.moveCategory(fromId, toId, options),
  };
}

export type CategoryRulesService = ReturnType<typeof createCategoryRulesService>;
