/**
 * Identity used to spot the same movement arriving twice: day, amount and a
 * third part that narrows it down (the account, or the currency when the
 * account is not known yet).
 */
export function duplicateKey(date: string, amountCents: number, scope: string): string {
  return `${date}|${amountCents}|${scope}`;
}
