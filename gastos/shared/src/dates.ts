/**
 * Calendar days are stored and transported as "YYYY-MM-DD" strings, never as
 * timestamps, so an expense made late on the 31st cannot slip into the next
 * month because of a time zone. This module is the only place that does date
 * arithmetic.
 */

export type IsoDate = string;
export type MonthKey = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function build(year: number, month: number, day: number): IsoDate | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid && year >= 1900 && year <= 2200 ? `${pad(year, 4)}-${pad(month)}-${pad(day)}` : null;
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  return build(Number(match[1]), Number(match[2]), Number(match[3])) !== null;
}

export function isMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/** Today's calendar day in the given IANA time zone. */
export function todayIso(timeZone: string, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function monthKeyOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function firstDayOfMonth(month: MonthKey): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: MonthKey): IsoDate {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${pad(lastDay)}`;
}

/** Adds calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const year = Number(date.slice(0, 4));
  const monthIndex = Number(date.slice(5, 7)) - 1 + months;
  const day = Number(date.slice(8, 10));
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${pad(targetYear, 4)}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

export function addMonthsToKey(month: MonthKey, months: number): MonthKey {
  return monthKeyOf(addMonths(firstDayOfMonth(month), months));
}

/**
 * Reads a date written by a person or produced by a spreadsheet:
 * "2026-10-05", "05/10/2026", "5-10-26" (day first) or a Date object.
 */
export function parseFlexibleDate(input: unknown): IsoDate | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return build(input.getUTCFullYear(), input.getUTCMonth() + 1, input.getUTCDate());
  }
  if (typeof input !== 'string') return null;
  const text = input.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (dayFirst) {
    const rawYear = Number(dayFirst[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return build(year, Number(dayFirst[2]), Number(dayFirst[1]));
  }
  return null;
}

/** "05/10/2026" for display. */
export function formatDate(date: IsoDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** "octubre de 2026" for display. */
export function formatMonth(month: MonthKey, locale = 'es-AR'): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
