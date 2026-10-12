import type { CategoryRule } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { CategoryRuleModel, type CategoryRuleDoc } from './categoryRules.model';

/** A rule as stored: the public fields plus the normalised merchant it is matched by. */
export type StoredRule = CategoryRule & { merchantKey: string };

function toRule(doc: CategoryRuleDoc): StoredRule {
  return {
    id: doc._id.toString(),
    merchant: doc.merchant,
    merchantKey: doc.merchantKey,
    categoryId: doc.categoryId.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const categoryRulesPort = createCollectionPort(CategoryRuleModel, [
  { field: 'categoryId', to: COLLECTIONS.categories },
]);

export const categoryRulesRepository = {
  async findAll(options: WriteOptions = {}): Promise<StoredRule[]> {
    const docs = await CategoryRuleModel.find()
      .sort({ merchantKey: 1 })
      .session(options.session ?? null)
      .lean<CategoryRuleDoc[]>();
    return docs.map(toRule);
  },

  /** Creates the rule for a merchant or points the existing one at another category. */
  async upsert(
    data: { merchant: string; merchantKey: string; categoryId: string },
    options: WriteOptions = {},
  ): Promise<StoredRule> {
    const doc = await CategoryRuleModel.findOneAndUpdate(
      { merchantKey: data.merchantKey },
      { $set: { merchant: data.merchant, categoryId: toObjectId(data.categoryId) } },
      { new: true, upsert: true, session: options.session },
    ).lean<CategoryRuleDoc>();
    return toRule(doc!);
  },

  async delete(id: string): Promise<boolean> {
    const result = await CategoryRuleModel.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  },

  async deleteByCategory(categoryId: string, options: WriteOptions = {}): Promise<void> {
    await CategoryRuleModel.deleteMany({ categoryId: toObjectId(categoryId) }, { session: options.session });
  },

  async moveCategory(fromId: string, toId: string, options: WriteOptions = {}): Promise<void> {
    await CategoryRuleModel.updateMany(
      { categoryId: toObjectId(fromId) },
      { $set: { categoryId: toObjectId(toId) } },
      { session: options.session },
    );
  },
};

export type CategoryRulesRepository = typeof categoryRulesRepository;
