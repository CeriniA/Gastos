import type { AccountType, IsoDate } from '@gastos/shared';

/**
 * The only function that decides a transaction's payment date, which is the
 * date the monthly balance is built on.
 *
 * - Cash, bank and wallet accounts: paid the day it happens.
 * - Credit cards: the due date of the statement the purchase falls in. Until
 *   the card-periods module supplies that (stage 3), the date the user
 *   entered by hand, and failing that the purchase date.
 */
export function resolvePaymentDate(input: {
  date: IsoDate;
  accountType: AccountType;
  requested: IsoDate | null;
  periodDueDate: IsoDate | null;
}): IsoDate {
  if (input.accountType !== 'credit_card') return input.date;
  return input.periodDueDate ?? input.requested ?? input.date;
}
