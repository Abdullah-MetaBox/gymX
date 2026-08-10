import { describe, expect, it } from 'vitest';
import {
  add,
  allocate,
  cents,
  format,
  fromMajor,
  MoneyError,
  multiply,
  percentage,
  roundHalfAwayFromZero,
  split,
  subtract,
  toMajor,
  vatFromGross,
  vatFromNet,
} from './index';

describe('construction', () => {
  it('rejects non-integer cents', () => {
    expect(() => cents(10.5)).toThrow(MoneyError);
  });

  it('converts major units', () => {
    expect(fromMajor(1800)).toBe(180_000);
    expect(fromMajor(0.05)).toBe(5);
    expect(toMajor(cents(180_000))).toBe(1800);
  });

  it('rejects sub-cent precision rather than silently rounding it away', () => {
    expect(() => fromMajor(10.005)).toThrow(MoneyError);
  });

  it('rounds half away from zero, unlike Math.round', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(Math.round(-2.5)).toBe(-2); // the behaviour we are avoiding
  });
});

describe('arithmetic', () => {
  it('adds and subtracts exactly', () => {
    // The canonical float failure: 0.1 + 0.2 !== 0.3
    expect(add(fromMajor(0.1), fromMajor(0.2))).toBe(fromMajor(0.3));
    expect(subtract(cents(200_000), cents(180_000))).toBe(20_000);
  });

  it('multiplies by a quantity', () => {
    expect(multiply(cents(35_000), 3)).toBe(105_000);
  });

  it('takes percentages', () => {
    expect(percentage(cents(100_000), 15)).toBe(15_000);
  });
});

describe('allocate — the largest remainder method', () => {
  it('splits Rs 3,500 across 3 members without losing a cent', () => {
    const parts = split(fromMajor(3500), 3);
    expect(parts).toEqual([116_667, 116_667, 116_666]);
    expect(add(...parts)).toBe(fromMajor(3500));
  });

  it('splits Rs 3,500 across 7 members without losing a cent', () => {
    const parts = split(fromMajor(3500), 7);
    expect(add(...parts)).toBe(fromMajor(3500));
    expect(parts).toHaveLength(7);
  });

  it('never loses or invents a cent, across many shapes', () => {
    for (let total = 0; total <= 400; total += 7) {
      for (let count = 1; count <= 9; count += 1) {
        const parts = split(cents(total), count);
        expect(add(...parts)).toBe(cents(total));
        // No share may differ from another by more than one cent.
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('honours weights', () => {
    const parts = allocate(fromMajor(1000), [3, 1]);
    expect(parts).toEqual([75_000, 25_000]);
  });

  it('is deterministic — ties go to the earlier share', () => {
    expect(split(cents(10), 4)).toEqual([3, 3, 2, 2]);
    expect(split(cents(10), 4)).toEqual(split(cents(10), 4));
  });

  it('distributes negative totals (refunds) symmetrically', () => {
    const positive = split(fromMajor(3500), 3);
    const negative = split(cents(-fromMajor(3500)), 3);
    expect(negative).toEqual(positive.map((p) => -p));
    expect(add(...negative)).toBe(-fromMajor(3500));
  });

  it('rejects empty or zero-sum weights', () => {
    expect(() => allocate(cents(100), [])).toThrow(MoneyError);
    expect(() => allocate(cents(100), [0, 0])).toThrow(MoneyError);
  });
});

describe('VAT', () => {
  it('adds VAT to a net price', () => {
    expect(vatFromNet(fromMajor(1000), 15)).toEqual({
      net: 100_000,
      vat: 15_000,
      gross: 115_000,
    });
  });

  it('extracts VAT from a gross price', () => {
    const { net, vat, gross } = vatFromGross(fromMajor(1800), 15);
    expect(gross).toBe(180_000);
    expect(net).toBe(156_522);
    expect(vat).toBe(23_478);
  });

  it('always satisfies net + vat === gross, so the VAT return cannot drift', () => {
    for (let amount = 1; amount <= 5000; amount += 13) {
      const { net, vat, gross } = vatFromGross(cents(amount), 15);
      expect(net + vat).toBe(gross);
    }
  });
});

describe('format', () => {
  it('renders MUR for display', () => {
    // Non-breaking spaces vary by ICU build, so compare on digits.
    expect(format(fromMajor(1800))).toContain('1,800.00');
  });
});
