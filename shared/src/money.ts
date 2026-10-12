import type { Currency } from './constants';

/**
 * Money is always an integer number of cents. This module is the only place
 * that parses, rounds or formats amounts.
 */

/**
 * Parses a human-written amount into cents. Accepts "15400,50", "15.400,50",
 * "15400.50", "1,234.56" and plain numbers. A single separator followed by
 * exactly three digits ("1.500") is read as a thousands separator.
 * Returns null when the input is not a number.
 */
export function parseAmountToCents(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const cleaned = input.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const body = cleaned.replace(/-/g, '');

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  let decimalSeparator: '.' | ',' | null = null;
  if (lastDot >= 0 && lastComma >= 0) {
    decimalSeparator = lastDot > lastComma ? '.' : ',';
  } else {
    const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    if (separator) {
      const occurrences = body.split(separator).length - 1;
      const digitsAfter = body.length - body.lastIndexOf(separator) - 1;
      if (occurrences === 1 && digitsAfter !== 3) decimalSeparator = separator;
    }
  }

  let integerPart = body;
  let fractionPart = '';
  if (decimalSeparator) {
    const index = body.lastIndexOf(decimalSeparator);
    integerPart = body.slice(0, index);
    fractionPart = body.slice(index + 1);
  }
  integerPart = integerPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;

  const cents = Number(integerPart || '0') * 100 + Math.round(Number(`0.${fractionPart || '0'}`) * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** "15400,50": decimal comma, no thousands separator. Used for CSV and form fields. */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole},${fraction}`;
}

/** Cents as a decimal number, only for handing to a spreadsheet cell. */
export function centsToNumber(cents: number): number {
  return cents / 100;
}

/** "$ 15.400,50" / "US$ 100,00" / "R$ 50,00" for display. Accepts any ISO 4217 code. */
export function formatMoney(cents: number, currency: Currency | string, locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * Reads an exchange rate typed by a person ("272,50" or "272.5"). A rate is a
 * plain positive number, not an amount of money, so it keeps its decimals.
 */
export function parseRate(input: string): number | null {
  const text = input.trim().replace(/\s/g, '');
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  const rate = Number(text.replace(',', '.'));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** A rate for display and for form fields: "302,6223". */
export function formatRate(rate: number): string {
  return String(Number(rate.toFixed(4))).replace('.', ',');
}

/** An amount in another currency turned into cents of the account's currency. */
export function convertCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}

/**
 * The rate that really links an amount to the original it came from. Stored
 * instead of the rate typed, so it stays true when the total is corrected.
 */
export function impliedRate(amountCents: number, originalCents: number): number {
  return Number((amountCents / originalCents).toFixed(6));
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
