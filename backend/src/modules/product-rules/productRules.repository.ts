import type { ProductRule, ProductRuleInput } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { ProductRuleModel, type ProductRuleDoc } from './productRules.model';

/** A rule as stored: the public fields plus the normalised text it is matched by. */
export type StoredProductRule = ProductRule & { nameKey: string };

function toRule(doc: ProductRuleDoc): StoredProductRule {
  return {
    id: doc._id.toString(),
    name: doc.name,
    nameKey: doc.nameKey,
    product: doc.product ?? '',
    group: doc.group ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Nothing points from a product rule to other data. */
export const productRulesPort = createCollectionPort(ProductRuleModel, []);

export const productRulesRepository = {
  async findAll(): Promise<StoredProductRule[]> {
    const docs = await ProductRuleModel.find().sort({ nameKey: 1 }).lean<ProductRuleDoc[]>();
    return docs.map(toRule);
  },

  /** Creates the rule for a printed text, or replaces what the existing one says. */
  async upsert(
    data: ProductRuleInput & { nameKey: string },
    options: WriteOptions = {},
  ): Promise<StoredProductRule> {
    const doc = await ProductRuleModel.findOneAndUpdate(
      { nameKey: data.nameKey },
      { $set: { name: data.name, product: data.product, group: data.group } },
      { new: true, upsert: true, session: options.session },
    ).lean<ProductRuleDoc>();
    return toRule(doc!);
  },

  async delete(id: string): Promise<boolean> {
    const result = await ProductRuleModel.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  },
};

export type ProductRulesRepository = typeof productRulesRepository;
