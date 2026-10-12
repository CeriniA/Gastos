import { addDays, addMonths, type IsoDate } from '@gastos/shared';

/**
 * Installments after the first are dated this many days after a closing, and
 * a month apart: half a period, so each one still falls in the right
 * statement when the next closings move a few days either way.
 */
const DAYS_INTO_NEXT_PERIOD = 15;

/**
 * The closing of the statement a purchase falls in: the first closing on or
 * after it. Months without a known closing are estimated from a known one,
 * a month at a time. Null when the card has no closing at all.
 */
export function closingCovering(date: IsoDate, closings: readonly IsoDate[]): IsoDate | null {
  const sorted = [...closings].sort();
  let closing = sorted.find((candidate) => candidate >= date) ?? sorted.at(-1);
  if (!closing) return null;
  while (closing < date) closing = addMonths(closing, 1);
  while (addMonths(closing, -1) >= date) closing = addMonths(closing, -1);
  return closing;
}

/** Dates of `count` installments that come after the statement closing on `closing`, one per statement. */
export function datesAfterClosing(closing: IsoDate, count: number): IsoDate[] {
  const first = addDays(closing, DAYS_INTO_NEXT_PERIOD);
  return Array.from({ length: count }, (_, index) => addMonths(first, index));
}

/**
 * Every installment's date. The first is the purchase. The rest follow the
 * card's statements when its closings are known; otherwise they are a month
 * apart from the purchase, and the card's closings, once loaded, decide when
 * each is paid.
 */
export function installmentDates(
  purchaseDate: IsoDate,
  count: number,
  closings: readonly IsoDate[],
): IsoDate[] {
  const closing = closingCovering(purchaseDate, closings);
  const later = closing
    ? datesAfterClosing(closing, count - 1)
    : Array.from({ length: count - 1 }, (_, index) => addMonths(purchaseDate, index + 1));
  return [purchaseDate, ...later];
}
