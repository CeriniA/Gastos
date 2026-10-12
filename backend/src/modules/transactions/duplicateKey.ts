/**
 * Identity used to spot the same movement arriving twice: day, amount and a
 * third part that narrows it down (the account, or the currency when the
 * account is not known yet).
 */
export function duplicateKey(date: string, amountCents: number, scope: string): string {
  return `${date}|${amountCents}|${scope}`;
}

/** Identifies an installment ("3 of 6") of a given amount, whatever day it was stored on. */
export function installmentKey(
  installment: { number: number; total: number },
  amountCents: number,
  currency: string,
): string {
  return `${installment.number}/${installment.total}|${amountCents}|${currency}`;
}
