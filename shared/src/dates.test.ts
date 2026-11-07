import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MS_PER_DAY,
  shiftMoment,
  formatTime,
  addDays,
  dayInMonth,
  formatShortDate,
  dayOfMonth,
  formatMoment,
  hoursBetween,
  addMonths,
  addMonthsToKey,
  isIsoDate,
  lastDayOfMonth,
  monthKeyOf,
  parseFlexibleDate,
  todayIso,
} from './dates';

test('isIsoDate accepts only real calendar days', () => {
  assert.equal(isIsoDate('2026-10-05'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(isIsoDate('05/10/2026'), false);
});

test('todayIso uses the app time zone, not UTC', () => {
  const lateEvening = new Date('2026-11-01T01:30:00Z'); // 22:30 on Oct 31 in Buenos Aires
  assert.equal(todayIso('America/Argentina/Buenos_Aires', lateEvening), '2026-10-31');
  assert.equal(todayIso('UTC', lateEvening), '2026-11-01');
});

test('addMonths clamps the day and crosses years', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-03-10', -3), '2025-12-10');
  assert.equal(addMonthsToKey('2026-12', 1), '2027-01');
});

test('month helpers', () => {
  assert.equal(monthKeyOf('2026-10-05'), '2026-10');
  assert.equal(lastDayOfMonth('2026-02'), '2026-02-28');
  assert.equal(lastDayOfMonth('2026-12'), '2026-12-31');
});

test('parseFlexibleDate reads day-first dates and spreadsheet dates', () => {
  assert.equal(parseFlexibleDate('2026-10-05'), '2026-10-05');
  assert.equal(parseFlexibleDate('05/10/2026'), '2026-10-05');
  assert.equal(parseFlexibleDate('5-10-26'), '2026-10-05');
  assert.equal(parseFlexibleDate(new Date(Date.UTC(2026, 9, 5))), '2026-10-05');
  assert.equal(parseFlexibleDate('31/02/2026'), null);
  assert.equal(parseFlexibleDate('hoy'), null);
  assert.equal(parseFlexibleDate(42), null);
});

test('formatTime shows the hour in the app time zone, not UTC', () => {
  assert.equal(formatTime('2026-10-11T17:05:00.000Z', 'America/Argentina/Buenos_Aires'), '14:05');
});

test('days are added across months and years, and back', () => {
  assert.equal(addDays('2026-10-25', 15), '2026-11-09');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('hours between two moments, and a moment as the user reads it', () => {
  assert.equal(hoursBetween('2026-10-12T12:00:00.000Z', '2026-10-13T18:00:00.000Z'), 30);
  assert.equal(
    formatMoment('2026-10-12T17:30:00.000Z', 'America/Argentina/Buenos_Aires'),
    '12/10/2026 14:30',
  );
});

test('a day of a month is clamped to the months that are shorter', () => {
  assert.equal(dayOfMonth('2026-10-05'), 5);
  assert.equal(dayInMonth('2026-10', 15), '2026-10-15');
  assert.equal(dayInMonth('2026-02', 31), '2026-02-28');
  assert.equal(dayInMonth('2028-02', 30), '2028-02-29');
});

test('a short date leaves the year out only when it is this year', () => {
  assert.equal(formatShortDate('2026-10-05', '2026-10-17'), '05/10');
  assert.equal(formatShortDate('2025-12-31', '2026-10-17'), '31/12/2025');
});

test('a moment is shifted by exact milliseconds, forward and back', () => {
  const noon = new Date('2026-10-10T12:00:00.000Z');
  assert.equal(shiftMoment(noon, MS_PER_DAY).toISOString(), '2026-10-11T12:00:00.000Z');
  assert.equal(shiftMoment(noon, -30 * MS_PER_DAY).toISOString(), '2026-09-10T12:00:00.000Z');
});
