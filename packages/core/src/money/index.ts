/**
 * Money.
 *
 * Every monetary value in GymX is an integer number of **minor units** (cents).
 * Floats never touch money: `0.1 + 0.2 !== 0.3` is not an acceptable property
 * for a system whose entire purpose is making a VAT declaration reconcile.
 *
 * Stored as `bigint` in Postgres for range safety; carried as `number` in
 * TypeScript, which is exact for integers up to 2^53 - 1 (Rs 90,071,992,547,409).
 * No gym will exceed that.
 */

/** An integer number of cents. Branded so a raw rupee figure can't be passed by mistake. */
export type Cents = number & { readonly __brand: 'Cents' };

export class MoneyError extends Error {
  override readonly name = 'MoneyError';
}

function assertInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of cents, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} exceeds the safe integer range: ${value}`);
  }
}

/** Wrap a raw integer that is already in cents. */
export function cents(value: number): Cents {
  assertInteger(value, 'value');
  return value as Cents;
}

export const ZERO: Cents = 0 as Cents;

/**
 * Convert a major-unit amount (rupees) to cents.
 * Accepts at most 2 decimal places; anything finer is a bug at the call site,
 * not something to silently round away.
 */
export function fromMajor(amount: number): Cents {
  if (!Number.isFinite(amount)) {
    throw new MoneyError(`Amount must be finite, received ${amount}`);
  }
  const scaled = roundHalfAwayFromZero(amount * 100);
  if (Math.abs(scaled - amount * 100) > 1e-6) {
    throw new MoneyError(`Amount ${amount} has more precision than 2 decimal places`);
  }
  return cents(scaled);
}

/** Convert cents back to a major-unit number. For display and export only — never for arithmetic. */
export function toMajor(value: Cents): number {
  return value / 100;
}

/** Round half away from zero. `Math.round` rounds -0.5 to -0, which skews refunds. */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function add(...values: Cents[]): Cents {
  return cents(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negate(value: Cents): Cents {
  return cents(-value);
}

export function abs(value: Cents): Cents {
  return cents(Math.abs(value));
}

/** Multiply by a quantity (e.g. 3 sessions). Rounds half away from zero. */
export function multiply(value: Cents, factor: number): Cents {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`Factor must be finite, received ${factor}`);
  }
  return cents(roundHalfAwayFromZero(value * factor));
}

/** Take a percentage of an amount. `percentage(cents(10_000), 15)` -> 1500. */
export function percentage(value: Cents, percent: number): Cents {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`Percent must be finite, received ${percent}`);
  }
  return cents(roundHalfAwayFromZero((value * percent) / 100));
}

export function isZero(value: Cents): boolean {
  return value === 0;
}

export function compare(a: Cents, b: Cents): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function max(...values: Cents[]): Cents {
  if (values.length === 0) throw new MoneyError('max() requires at least one value');
  return cents(Math.max(...values));
}

export function min(...values: Cents[]): Cents {
  if (values.length === 0) throw new MoneyError('min() requires at least one value');
  return cents(Math.min(...values));
}

/**
 * Split an amount across weighted shares using the **largest remainder method**,
 * so the parts always sum back to exactly the total.
 *
 * This is why it exists: a Rs 3,500 family bundle divided across 3 members is
 * 1166.666… each. Naive rounding gives 3 x 1167 = Rs 3,501 and the gym's books
 * are one cent out, every month, forever. Here the remainder is handed to the
 * largest fractional shares in order, so the result is 1167 + 1167 + 1166.
 *
 * Ties go to the earlier index, making the split deterministic and reproducible.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  if (weights.length === 0) {
    throw new MoneyError('allocate() requires at least one weight');
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError('Weights must be finite and non-negative');
  }

  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  if (weightTotal <= 0) {
    throw new MoneyError('Weights must sum to more than zero');
  }

  // Work on the magnitude so negative totals (refunds, credit notes) distribute
  // identically to their positive counterparts rather than skewing by sign.
  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);

  const exact = weights.map((w) => (magnitude * w) / weightTotal);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = magnitude - floored.reduce((sum, v) => sum + v, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => (b.fraction === a.fraction ? a.index - b.index : b.fraction - a.fraction));

  const result = [...floored];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] = (result[index] as number) + 1;
    remainder -= 1;
  }

  return result.map((v) => cents(sign * v));
}

/** Split evenly across `count` shares. Convenience over `allocate`. */
export function split(total: Cents, count: number): Cents[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new MoneyError(`Count must be a positive integer, received ${count}`);
  }
  return allocate(total, new Array(count).fill(1));
}

export interface VatBreakdown {
  /** Amount excluding VAT. */
  net: Cents;
  /** The VAT itself. */
  vat: Cents;
  /** Amount including VAT. */
  gross: Cents;
}

/**
 * VAT on a price that EXCLUDES tax.
 * `vatFromNet(cents(100_000), 15)` -> net 100000, vat 15000, gross 115000.
 */
export function vatFromNet(net: Cents, ratePercent: number): VatBreakdown {
  const vat = percentage(net, ratePercent);
  return { net, vat, gross: add(net, vat) };
}

/**
 * VAT already baked INTO a price — the common case in Mauritian retail pricing,
 * where "Rs 1,800 for a couple" is what the member actually pays.
 *
 * `vat` is derived by subtraction rather than computed independently, so
 * net + vat === gross always holds and the VAT return can never drift from
 * the invoice total by a rounding cent.
 */
export function vatFromGross(gross: Cents, ratePercent: number): VatBreakdown {
  if (!Number.isFinite(ratePercent) || ratePercent <= -100) {
    throw new MoneyError(`Invalid VAT rate: ${ratePercent}`);
  }
  const net = cents(roundHalfAwayFromZero(gross / (1 + ratePercent / 100)));
  return { net, vat: subtract(gross, net), gross };
}

export interface FormatOptions {
  locale?: string;
  currency?: string;
  /** 'narrowSymbol' gives "Rs 1,800.00"; 'code' gives "MUR 1,800.00". */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
}

/** Format for display. Never feed the result back into arithmetic. */
export function format(value: Cents, options: FormatOptions = {}): string {
  const { locale = 'en-GB', currency = 'MUR', currencyDisplay = 'narrowSymbol' } = options;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toMajor(value));
}
