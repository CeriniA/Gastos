import {
  applyProductRule,
  categoryWithRole,
  FINANCIAL_CHARGES_ROLE,
  nameKey,
  type Category,
  type ExtractionResult,
  type ProductRuleInput,
  type ReviewExtraction,
} from '@gastos/shared';

/**
 * Decides the category each extracted transaction is offered with:
 *   1. the user's rule for that merchant, if there is one;
 *   2. for interest, taxes and fees, the category with the role "financial_charges", if there is one;
 *   3. otherwise what the AI suggested;
 *   4. otherwise none.
 * A category is only offered if it exists, is not archived and matches the
 * transaction type. Nothing here is final: the user confirms or changes it.
 */
export function applyCategorySuggestions(
  extraction: ExtractionResult,
  categories: readonly Category[],
  rules: ReadonlyMap<string, string>,
): ReviewExtraction {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const charges = categoryWithRole(FINANCIAL_CHARGES_ROLE, categories);
  return {
    ...extraction,
    transactions: extraction.transactions.map(({ financialCharge, ...transaction }) => {
      const usable = (categoryId: string | null | undefined): string | null => {
        const category = categoryId ? byId.get(categoryId) : undefined;
        return category && !category.archived && category.kind === transaction.type ? category.id : null;
      };
      const fromRule = transaction.merchant ? usable(rules.get(nameKey(transaction.merchant))) : null;
      const fromCharge = financialCharge ? usable(charges?.id) : null;
      return {
        ...transaction,
        suggestedCategoryId: fromRule ?? fromCharge ?? usable(transaction.suggestedCategoryId),
        categoryFromRule: fromRule !== null,
      };
    }),
  };
}

/**
 * Each receipt line the user corrected before is offered with the product and
 * group they gave it then, instead of what the AI read. Still a suggestion:
 * the review shows it and the user can change it again.
 */
export function applyProductRules(
  extraction: ReviewExtraction,
  rules: ReadonlyMap<string, Pick<ProductRuleInput, 'product' | 'group'>>,
): ReviewExtraction {
  if (rules.size === 0) return extraction;
  return {
    ...extraction,
    transactions: extraction.transactions.map((transaction) => ({
      ...transaction,
      items: transaction.items.map((item) => applyProductRule(item, rules)),
    })),
  };
}
