import { nameKey, type ProductRule, type ProductRuleInput } from '@gastos/shared';
import type { WriteOptions } from '../../core/db/transaction';
import { NotFoundError } from '../../core/errors/errors';
import type { ProductRulesRepository, StoredProductRule } from './productRules.repository';

function toPublic(rule: StoredProductRule): ProductRule {
  const { nameKey: _nameKey, ...rest } = rule;
  return rest;
}

/**
 * Products the user corrected on a receipt, offered again for the same printed
 * line on the next ones. Saved only when the user agrees in the review.
 */
export function createProductRulesService(repository: ProductRulesRepository) {
  return {
    async list(): Promise<ProductRule[]> {
      return (await repository.findAll()).map(toPublic);
    },

    /** Product and group for each known printed line, keyed by its normalised text. */
    async lookup(): Promise<Map<string, Pick<ProductRule, 'product' | 'group'>>> {
      const rules = await repository.findAll();
      return new Map(rules.map((rule) => [rule.nameKey, { product: rule.product, group: rule.group }]));
    },

    async save(input: ProductRuleInput, options: WriteOptions = {}): Promise<ProductRule> {
      return toPublic(await repository.upsert({ ...input, nameKey: nameKey(input.name) }, options));
    },

    async remove(id: string): Promise<void> {
      if (!(await repository.delete(id))) throw new NotFoundError('ProductRule', id);
    },
  };
}

export type ProductRulesService = ReturnType<typeof createProductRulesService>;
