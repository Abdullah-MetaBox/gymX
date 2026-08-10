import { describe, expect, it } from 'vitest';
import {
  addDaysInZone,
  DEFAULT_TIME_ZONE,
  dateKeyInZone,
  formatTimeOfDay,
  isValidTimeZone,
  isWithinAnyWindow,
  isWithinWindow,
  minutesOfDayInZone,
  offsetMillis,
  parseTimeOfDay,
  partsInZone,
  startOfDayInZone,
  TimeError,
  timeWindow,
  wallTimeToInstant,
  weekdayInZone,
} from './index';

const MU = DEFAULT_TIME_ZONE; // Indian/Mauritius, UTC+4 year-round, no DST

describe('the test runner is deliberately in a different zone to the gym', () => {
  it('is not running in the gym timezone', () => {
    // If this ever fails, every assertion below stops proving anything.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe(MU);
  });
});

describe('reading wall-clock parts', () => {
  it('converts a UTC instant into Mauritian local parts', () => {
    // 2026-08-06T07:30:00Z is 11:30 in Mauritius (UTC+4).
    const parts = partsInZone(new Date('2026-08-06T07:30:00Z'), MU);
    expect(parts).toMatchObject({ year: 2026, month: 8, day: 6, hour: 11, minute: 30 });
  });

  it('reports the correct offset', () => {
    expect(offsetMillis(new Date('2026-08-06T07:30:00Z'), MU)).toBe(4 * 60 * 60 * 1000);
  });

  it('rolls the local date over before UTC does', () => {
    // 22:00 UTC is already the next day in Mauritius.
    const instant = new Date('2026-08-06T22:00:00Z');
    expect(dateKeyInZone(instant, MU)).toBe('2026-08-07');
    expect(dateKeyInZone(instant, 'UTC')).toBe('2026-08-06');
  });

  it('reports the local weekday, which can differ from the UTC weekday', () => {
    const instant = new Date('2026-08-08T22:00:00Z'); // Saturday in UTC
    expect(weekdayInZone(instant, 'UTC')).toBe(6);
    expect(weekdayInZone(instant, MU)).toBe(0); // already Sunday in Mauritius
  });

  it('handles midnight as hour 0, not hour 24', () => {
    expect(partsInZone(new Date('2026-08-06T20:00:00Z'), MU).hour).toBe(0);
  });

  it('rejects an unknown zone', () => {
    expect(() => partsInZone(new Date(), 'Mars/Olympus_Mons')).toThrow(TimeError);
    expect(isValidTimeZone(MU)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});

describe('writing wall-clock times back to instants', () => {
  it('round-trips local midnight', () => {
    const instant = wallTimeToInstant({ year: 2026, month: 8, day: 6 }, MU);
    expect(instant.toISOString()).toBe('2026-08-05T20:00:00.000Z');
    expect(dateKeyInZone(instant, MU)).toBe('2026-08-06');
  });

  it('finds the start of the local day from any instant within it', () => {
    const start = startOfDayInZone(new Date('2026-08-06T15:45:00Z'), MU);
    expect(start.toISOString()).toBe('2026-08-05T20:00:00.000Z');
  });

  it('survives a DST transition in a zone that has one', () => {
    // Europe/Paris springs forward 2026-03-29 02:00 -> 03:00.
    const before = wallTimeToInstant({ year: 2026, month: 3, day: 28, hour: 12 }, 'Europe/Paris');
    const after = wallTimeToInstant({ year: 2026, month: 3, day: 30, hour: 12 }, 'Europe/Paris');
    expect(partsInZone(before, 'Europe/Paris').hour).toBe(12);
    expect(partsInZone(after, 'Europe/Paris').hour).toBe(12);
    // Local noon to local noon across the shift is 47 hours, not 48.
    expect(after.getTime() - before.getTime()).toBe(47 * 60 * 60 * 1000);
  });

  it('keeps the wall-clock time when adding days across a DST shift', () => {
    const start = wallTimeToInstant({ year: 2026, month: 3, day: 28, hour: 9 }, 'Europe/Paris');
    const later = addDaysInZone(start, 2, 'Europe/Paris');
    expect(partsInZone(later, 'Europe/Paris')).toMatchObject({ day: 30, hour: 9 });
  });
});

describe('time-of-day parsing', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseTimeOfDay('11:00')).toBe(660);
    expect(parseTimeOfDay('13:00')).toBe(780);
    expect(parseTimeOfDay('09:05:00')).toBe(545);
  });

  it('rejects malformed and out-of-range values', () => {
    expect(() => parseTimeOfDay('25:00')).toThrow(TimeError);
    expect(() => parseTimeOfDay('11:60')).toThrow(TimeError);
    expect(() => parseTimeOfDay('lunchtime')).toThrow(TimeError);
  });

  it('formats back', () => {
    expect(formatTimeOfDay(660)).toBe('11:00');
    expect(formatTimeOfDay(0)).toBe('00:00');
  });
});

describe("access windows — GymABC's lunch tier", () => {
  // Thursday 6 August 2026. Lunch members: 11:00-13:00 local.
  const thursday = 4 as const;
  const lunch = timeWindow(thursday, '11:00', '13:00');

  const atLocal = (hour: number, minute = 0) =>
    wallTimeToInstant({ year: 2026, month: 8, day: 6, hour, minute }, MU);

  it('grants entry at 11:30 local', () => {
    expect(isWithinWindow(atLocal(11, 30), MU, lunch)).toBe(true);
  });

  it('denies entry at 15:00 local', () => {
    expect(isWithinWindow(atLocal(15), MU, lunch)).toBe(false);
  });

  it('denies entry at 10:59 and grants at exactly 11:00', () => {
    expect(isWithinWindow(atLocal(10, 59), MU, lunch)).toBe(false);
    expect(isWithinWindow(atLocal(11, 0), MU, lunch)).toBe(true);
  });

  it('treats the end of the window as exclusive', () => {
    expect(isWithinWindow(atLocal(12, 59), MU, lunch)).toBe(true);
    expect(isWithinWindow(atLocal(13, 0), MU, lunch)).toBe(false);
  });

  it('denies the same clock time on a different weekday', () => {
    const friday = wallTimeToInstant({ year: 2026, month: 8, day: 7, hour: 11, minute: 30 }, MU);
    expect(isWithinWindow(friday, MU, lunch)).toBe(false);
  });

  it('would give the WRONG answer if evaluated in UTC — the bug this guards against', () => {
    const elevenThirtyLocal = atLocal(11, 30);
    expect(isWithinWindow(elevenThirtyLocal, MU, lunch)).toBe(true);
    // The same instant is 07:30 UTC, outside the window. A timezone-naive
    // implementation reads the server clock and turns members away.
    expect(isWithinWindow(elevenThirtyLocal, 'UTC', lunch)).toBe(false);
  });

  it('matches any of several windows', () => {
    const windows = [timeWindow(1, '06:00', '09:00'), lunch];
    expect(isWithinAnyWindow(atLocal(11, 30), MU, windows)).toBe(true);
    expect(isWithinAnyWindow(atLocal(20), MU, windows)).toBe(false);
  });

  it('reports minutes since local midnight', () => {
    expect(minutesOfDayInZone(atLocal(11, 30), MU)).toBe(690);
  });
});

describe('windows that wrap past midnight', () => {
  // Thursday 22:00 -> Friday 02:00.
  const nightSlot = timeWindow(4, '22:00', '02:00');

  const atLocal = (day: number, hour: number) =>
    wallTimeToInstant({ year: 2026, month: 8, day, hour }, MU);

  it('admits the evening head on the named weekday', () => {
    expect(isWithinWindow(atLocal(6, 23), MU, nightSlot)).toBe(true);
  });

  it('admits the early-morning tail on the following day', () => {
    expect(isWithinWindow(atLocal(7, 1), MU, nightSlot)).toBe(true);
  });

  it('denies the gap between the tail and the next head', () => {
    expect(isWithinWindow(atLocal(7, 3), MU, nightSlot)).toBe(false);
    expect(isWithinWindow(atLocal(6, 21), MU, nightSlot)).toBe(false);
  });
});
