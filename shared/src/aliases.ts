import { nameKey } from './text';

/** Something in a list the user keeps (a merchant, a product) that is also known by printed texts. */
export interface Aliased {
  id: string;
  name: string;
  aliases: readonly string[];
}

/**
 * The texts to keep as known texts of an item: trimmed, without blanks, without
 * repeats (ignoring case and accents) and without the item's own name, which
 * is recognised anyway. Keeps the first spelling of each.
 */
export function cleanAliases(name: string, aliases: readonly string[]): string[] {
  const seen = new Set([nameKey(name)]);
  const kept: string[] = [];
  for (const alias of aliases) {
    const key = nameKey(alias);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    kept.push(alias.trim());
  }
  return kept;
}

/** The item whose name or known text is `text`, ignoring case and accents. */
export function findByPrintedText<T extends Aliased>(
  items: readonly T[],
  text: string,
  exceptId?: string,
): T | undefined {
  const key = nameKey(text);
  if (key === '') return undefined;
  return items.find(
    (item) =>
      item.id !== exceptId && (nameKey(item.name) === key || item.aliases.some((alias) => nameKey(alias) === key)),
  );
}
