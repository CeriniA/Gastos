/**
 * Normalised form of a user-written name, used for uniqueness checks and for
 * matching names coming from imported files ("Súper " and "super" are equal).
 */
export function nameKey(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}
