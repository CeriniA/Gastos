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

/** The dates of a card statement that decide when a purchase is paid. */
export interface PeriodDates {
  accountId: string;
  closingDate: IsoDate;
  dueDate: IsoDate;
}

/**
 * The due date of the statement a card purchase falls in: the first closing
 * on or after the purchase. Null when no known closing covers it yet.
 */
export function dueDateFor(periods: readonly PeriodDates[], date: IsoDate): IsoDate | null {
  let best: PeriodDates | null = null;
  for (const period of periods) {
    if (period.closingDate >= date && (!best || period.closingDate < best.closingDate)) best = period;
  }
  return best?.dueDate ?? null;
}
