/** Identity used to spot the same movement arriving twice: day, amount and account. */
export function duplicateKey(date: string, amountCents: number, accountId: string): string {
  return `${date}|${amountCents}|${accountId}`;
}
