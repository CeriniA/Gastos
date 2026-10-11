import type { Category, CategoryKind } from '@gastos/shared';

/** Categories of one kind in display order: each parent followed by its children. */
export function orderedTree(categories: readonly Category[], kind: CategoryKind): Category[] {
  const ofKind = categories.filter((category) => category.kind === kind);
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'es');
  const walk = (parentId: string | null): Category[] =>
    ofKind
      .filter((category) => category.parentId === parentId)
      .sort(byName)
      .flatMap((category) => [category, ...walk(category.id)]);
  return walk(null);
}

/** Indented label for a <select> option. */
export function optionLabel(category: Category): string {
  return `${'\u00A0\u00A0\u00A0'.repeat(category.depth - 1)}${category.name}`;
}
