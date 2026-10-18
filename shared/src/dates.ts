/**
 * Calendar days are stored and transported as "YYYY-MM-DD" strings, never as
 * timestamps, so an expense made late on the 31st cannot slip into the next
 * month because of a time zone. This module is the only place that does date
 * arithmetic.
 */

import { APP_LOCALE } from './constants';

export type IsoDate = string;
export type MonthKey = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Dates outside these years are typos, not real transactions. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;
/** "05/10/26" means 2026. */
const TWO_DIGIT_YEAR_BASE = 2000;
const TWO_DIGIT_YEAR_LIMIT = 100;

function build(year: number, month: number, day: number): IsoDate | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid && year >= MIN_YEAR && year <= MAX_YEAR ? `${pad(year, 4)}-${pad(month)}-${pad(day)}` : null;
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

/** The day of the month of a date: 5 for "2026-10-05". */
export function dayOfMonth(date: IsoDate): number {
  return Number(date.slice(8, 10));
}

/** That day of a month, or the month's last day when it is shorter (day 31 of February is the 28th or 29th). */
export function dayInMonth(month: MonthKey, day: number): IsoDate {
  const last = lastDayOfMonth(month);
  return `${month}-${pad(Math.min(day, dayOfMonth(last)))}`;
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

/** Adds calendar days; a negative number goes back. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const moment = new Date(`${date}T00:00:00.000Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
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
    const year = rawYear < TWO_DIGIT_YEAR_LIMIT ? TWO_DIGIT_YEAR_BASE + rawYear : rawYear;
    return build(year, Number(dayFirst[2]), Number(dayFirst[1]));
  }
  return null;
}

/** "05/10/2026" for display. */
export function formatDate(date: IsoDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** "05/10" when the date is in the year of `today`; the whole date otherwise. For lists, where room is short. */
export function formatShortDate(date: IsoDate, today: IsoDate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : formatDate(date);
}

/** "14:05": the hour and minute of a moment, in the given time zone. */
export function formatTime(moment: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(moment));
}

/** "octubre de 2026" for display. */
export function formatMonth(month: MonthKey, locale = APP_LOCALE): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

const HOUR_MS = 60 * 60 * 1000;

/** Hours from one moment to another (fractional; negative if `to` is earlier). */
export function hoursBetween(from: string | Date, to: string | Date): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / HOUR_MS;
}

/** A moment as the user reads it in a time zone: "12/10/2026 14:30". */
export function formatMoment(moment: string | Date, timeZone: string): string {
  return `${formatDate(todayIso(timeZone, new Date(moment)))} ${formatTime(moment, timeZone)}`;
}
