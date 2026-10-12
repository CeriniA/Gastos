import { nameKey, type Category, type ExtractionResult, type ReviewExtraction } from '@gastos/shared';

/**
 * Decides the category each extracted transaction is offered with:
 *   1. the user's rule for that merchant, if there is one;
 *   2. otherwise what the AI suggested;
 *   3. otherwise none.
 * A category is only offered if it exists, is not archived and matches the
 * transaction type. Nothing here is final: the user confirms or changes it.
 */
export function applyCategorySuggestions(
  extraction: ExtractionResult,
  categories: readonly Category[],
  rules: ReadonlyMap<string, string>,
): ReviewExtraction {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return {
    ...extraction,
    transactions: extraction.transactions.map((transaction) => {
      const usable = (categoryId: string | null | undefined): string | null => {
        const category = categoryId ? byId.get(categoryId) : undefined;
        return category && !category.archived && category.kind === transaction.type ? category.id : null;
      };
      const fromRule = transaction.merchant ? usable(rules.get(nameKey(transaction.merchant))) : null;
      return {
        ...transaction,
        suggestedCategoryId: fromRule ?? usable(transaction.suggestedCategoryId),
        categoryFromRule: fromRule !== null,
      };
    }),
  };
}
