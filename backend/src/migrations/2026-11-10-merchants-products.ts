import {
  PRODUCT_GROUP_LABELS,
  nameKey,
  type ProductGroup,
} from '@gastos/shared';
import type { Migration } from '../core/db/migrations';
import { logger } from '../core/logger';
import { CategoryModel } from '../modules/categories/categories.model';
import { CategoryRuleModel } from '../modules/category-rules/categoryRules.model';
import { MerchantModel } from '../modules/merchants/merchants.model';
import { ProductRuleModel } from '../modules/product-rules/productRules.model';
import { ProductModel } from '../modules/products/products.model';
import { TransactionModel } from '../modules/transactions/transactions.model';
import { groupsInUse, planLists, type LegacyTransaction } from './legacyLists';

/**
 * Fills the new lists from what the user already has, without touching their
 * transactions (those keep their description and products until they point at
 * the lists):
 *  - each distinct description of an expense becomes a merchant, joining the ones
 *    that differ only in case or accents; a "this merchant goes to this category"
 *    rule becomes its usual category;
 *  - each distinct product of a receipt becomes a product, and the lines as the
 *    receipt printed them become its known texts;
 *  - each product group in use becomes a category (a root expense category with the
 *    group's name, or the one the user already has with that name), and is the
 *    category of its products.
 * What already exists in the lists is left alone, so running it twice adds nothing.
 */
export const merchantsProducts: Migration = {
  id: '2026-11-10-merchants-products',
  async up() {
    const categories = await CategoryModel.find().lean();
    const expenseRoots = categories.filter((category) => category.kind === 'expense' && !category.parentId);
    const expenseCategoryIds = new Set(
      categories.filter((category) => category.kind === 'expense').map((category) => category._id.toString()),
    );

    const transactions = (
      await TransactionModel.find(
        { type: 'expense', deletedAt: null },
        { description: 1, categoryId: 1, items: 1 },
      ).lean()
    ).map(
      (doc): LegacyTransaction => ({
        description: doc.description ?? '',
        categoryId: doc.categoryId ? doc.categoryId.toString() : null,
        items: doc.items ?? [],
      }),
    );
    const categoryRules = (await CategoryRuleModel.find().lean()).map((rule) => ({
      merchant: rule.merchant,
      categoryId: rule.categoryId.toString(),
    }));
    const productRules = (await ProductRuleModel.find().lean()).map((rule) => ({
      name: rule.name,
      product: rule.product,
      group: rule.group,
    }));

    const groupCategories: Partial<Record<ProductGroup, string>> = {};
    for (const group of groupsInUse({ transactions, productRules })) {
      const name = PRODUCT_GROUP_LABELS[group];
      const existing = expenseRoots.find((category) => category.nameKey === nameKey(name));
      const id = existing
        ? existing._id.toString()
        : (await CategoryModel.create({ name, nameKey: nameKey(name), kind: 'expense', parentId: null })).id;
      groupCategories[group] = id;
      expenseCategoryIds.add(id);
    }

    const plan = planLists({ transactions, categoryRules, productRules, expenseCategoryIds, groupCategories });

    const knownMerchants = new Set((await MerchantModel.find({}, { nameKey: 1 }).lean()).map((m) => m.nameKey));
    await MerchantModel.insertMany(
      plan.merchants
        .filter((merchant) => !knownMerchants.has(nameKey(merchant.name)))
        .map((merchant) => ({
          name: merchant.name,
          nameKey: nameKey(merchant.name),
          defaultCategoryId: merchant.defaultCategoryId,
        })),
    );

    const known = await ProductModel.find({}, { nameKey: 1, aliasKeys: 1 }).lean();
    const takenKeys = new Set(known.flatMap((product) => [product.nameKey, ...product.aliasKeys]));
    const fresh = plan.products.filter((product) => !takenKeys.has(nameKey(product.name)));
    await ProductModel.insertMany(
      fresh.map((product) => {
        const aliases = product.aliases.filter((alias) => !takenKeys.has(nameKey(alias)));
        return {
          name: product.name,
          nameKey: nameKey(product.name),
          categoryId: product.categoryId,
          aliases,
          aliasKeys: aliases.map(nameKey),
        };
      }),
    );

    if (plan.productsWithoutCategory > 0) {
      logger.warn({ count: plan.productsWithoutCategory }, 'Products left out of the list: no category known');
    }
  },
};
