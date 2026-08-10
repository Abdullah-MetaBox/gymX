/**
 * Timezone-aware time.
 *
 * Every instant in GymX is stored as UTC (`timestamptz`). Every *rule* about
 * time — "lunch members may enter between 11:00 and 13:00" — is expressed in
 * the gym's local wall clock. Converting between the two is where access
 * control silently breaks, so it happens here and nowhere else.
 *
 * Nothing in this module reads the ambient system timezone. Every function
 * that cares takes an explicit `timeZone`. A server in Frankfurt and a laptop
 * in Port Louis must produce identical verdicts.
 */

export const DEFAULT_TIME_ZONE = 'Indian/Mauritius';

/** 0 = Sunday … 6 = Saturday. Matches `Date.prototype.getUTCDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Minutes since local midnight, 0 – 1439. */
export type MinutesOfDay = number;

export const MINUTES_PER_DAY = 1440;

export class TimeError extends Error {
  override readonly name = 'TimeError';
}

export interface ZonedParts {
  year: number;
  /** 1 – 12. */
  month: number;
  /** 1 – 31. */
  day: number;
  /** 0 – 23. */
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      throw new TimeError(`Unknown IANA time zone: ${timeZone}`);
    }
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** True if the runtime recognises the zone. Used to validate gym settings. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

function assertValidDate(instant: Date): void {
  if (Number.isNaN(instant.getTime())) {
    throw new TimeError('Invalid Date passed to a time helper');
  }
}

/** `Date.UTC` maps years 0–99 into the 1900s; this does not. */
function utcFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond = 0,
): number {
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  if (year >= 0 && year < 100) {
    const shifted = new Date(timestamp);
    shifted.setUTCFullYear(year);
    return shifted.getTime();
  }
  return timestamp;
}

/** Break an instant into its wall-clock parts in the given zone. */
export function partsInZone(instant: Date, timeZone: string): ZonedParts {
  assertValidDate(instant);
  const fields: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') fields[part.type] = part.value;
  }

  const year = Number(fields.year);
  const month = Number(fields.month);
  const day = Number(fields.day);
  // Some engines render midnight as hour 24 rather than 0.
  const hour = Number(fields.hour) % 24;
  const minute = Number(fields.minute);
  const second = Number(fields.second);

  const weekday = new Date(utcFromParts(year, month, day, 12, 0, 0)).getUTCDay() as Weekday;

  return { year, month, day, hour, minute, second, weekday };
}

/** The zone's UTC offset in milliseconds at a given instant (DST-aware). */
export function offsetMillis(instant: Date, timeZone: string): number {
  const parts = partsInZone(instant, timeZone);
  const asIfUtc = utcFromParts(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    instant.getUTCMilliseconds(),
  );
  return asIfUtc - instant.getTime();
}

export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

/**
 * Turn a local wall-clock time into the UTC instant it denotes.
 *
 * The offset depends on the instant, and the instant depends on the offset, so
 * this resolves in two passes: guess with the offset at the naive timestamp,
 * then re-check with the offset at the candidate. Only a DST transition makes
 * the two disagree — Mauritius has none, but GymX should not be wrong when it
 * is sold somewhere that does.
 */
export function wallTimeToInstant(wall: WallTime, timeZone: string): Date {
  const naive = utcFromParts(
    wall.year,
    wall.month,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
    wall.millisecond ?? 0,
  );

  const firstOffset = offsetMillis(new Date(naive), timeZone);
  let candidate = naive - firstOffset;
  const secondOffset = offsetMillis(new Date(candidate), timeZone);
  if (secondOffset !== firstOffset) {
    candidate = naive - secondOffset;
  }
  return new Date(candidate);
}

/** The UTC instant of local midnight starting the day that contains `instant`. */
export function startOfDayInZone(instant: Date, timeZone: string): Date {
  const { year, month, day } = partsInZone(instant, timeZone);
  return wallTimeToInstant({ year, month, day }, timeZone);
}

/** The UTC instant of local midnight ending the day that contains `instant`. */
export function endOfDayInZone(instant: Date, timeZone: string): Date {
  const { year, month, day } = partsInZone(instant, timeZone);
  return wallTimeToInstant({ year, month, day: day + 1 }, timeZone);
}

/** Local calendar date as `YYYY-MM-DD`. The canonical key for day-grained data. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const { year, month, day } = partsInZone(instant, timeZone);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function weekdayInZone(instant: Date, timeZone: string): Weekday {
  return partsInZone(instant, timeZone).weekday;
}

export function minutesOfDayInZone(instant: Date, timeZone: string): MinutesOfDay {
  const { hour, minute } = partsInZone(instant, timeZone);
  return hour * 60 + minute;
}

/** Add whole days in local terms, so the wall-clock time survives a DST shift. */
export function addDaysInZone(instant: Date, days: number, timeZone: string): Date {
  const parts = partsInZone(instant, timeZone);
  return wallTimeToInstant(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day + days,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    },
    timeZone,
  );
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Parse `HH:MM` or `HH:MM:SS` into minutes since midnight. */
export function parseTimeOfDay(value: string): MinutesOfDay {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    throw new TimeError(`Expected HH:MM or HH:MM:SS, received "${value}"`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new TimeError(`Time out of range: "${value}"`);
  }
  return hour * 60 + minute;
}

export function formatTimeOfDay(minutes: MinutesOfDay): string {
  const normalised = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(normalised / 60), 2)}:${pad(normalised % 60, 2)}`;
}

/**
 * A recurring local time window — the shape of `plan_access_rules` in Phase 2.
 * `endMinutes` is exclusive. An `endMinutes` at or before `startMinutes` means
 * the window wraps past local midnight (e.g. a 22:00–02:00 night slot).
 */
export interface TimeWindow {
  weekday: Weekday;
  startMinutes: MinutesOfDay;
  endMinutes: MinutesOfDay;
}

export function timeWindow(
  weekday: Weekday,
  start: string | MinutesOfDay,
  end: string | MinutesOfDay,
): TimeWindow {
  return {
    weekday,
    startMinutes: typeof start === 'string' ? parseTimeOfDay(start) : start,
    endMinutes: typeof end === 'string' ? parseTimeOfDay(end) : end,
  };
}

/**
 * Does `instant` fall inside `window`, evaluated in the gym's own timezone?
 *
 * This is the predicate GymABC's entire Lunch tier rests on. It is the reason
 * every function above takes an explicit zone: read the wall clock wrong and
 * the door opens at the wrong hour, quietly, for everyone.
 */
export function isWithinWindow(instant: Date, timeZone: string, window: TimeWindow): boolean {
  const parts = partsInZone(instant, timeZone);
  const minutes = parts.hour * 60 + parts.minute;
  const { startMinutes, endMinutes, weekday } = window;

  if (endMinutes > startMinutes) {
    return parts.weekday === weekday && minutes >= startMinutes && minutes < endMinutes;
  }

  // Wrapping window: the head belongs to `weekday`, the tail spills into the
  // following day and must be matched against that day instead.
  if (parts.weekday === weekday && minutes >= startMinutes) return true;
  const previousDay = ((parts.weekday + 6) % 7) as Weekday;
  return previousDay === weekday && minutes < endMinutes;
}

/** True if any window admits the instant. */
export function isWithinAnyWindow(
  instant: Date,
  timeZone: string,
  windows: readonly TimeWindow[],
): boolean {
  return windows.some((window) => isWithinWindow(instant, timeZone, window));
}

export interface FormatInstantOptions {
  timeZone: string;
  locale?: string;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

export function formatInstant(instant: Date, options: FormatInstantOptions): string {
  const { timeZone, locale = 'en-GB', dateStyle = 'medium', timeStyle = 'short' } = options;
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle, timeStyle }).format(instant);
}
