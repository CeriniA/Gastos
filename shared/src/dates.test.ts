import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatTime,
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
