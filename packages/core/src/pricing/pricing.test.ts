import { describe, expect, it } from 'vitest';
import { findTier, type PriceTier, priceForSize } from './index';

// Gym ABC's Full plan: solo Rs 1,000, couple Rs 1,800, family (3+) Rs 3,500.
const GYM_ABC_TIERS: PriceTier[] = [
  { sizeFrom: 2, sizeTo: 2, priceCents: 180_000 },
  { sizeFrom: 3, sizeTo: null, priceCents: 350_000 },
];

describe('findTier', () => {
  it('prefers a bounded tier over an open-ended one covering the same size', () => {
    const tiers: PriceTier[] = [
      { sizeFrom: 1, sizeTo: null, priceCents: 100 },
      { sizeFrom: 2, sizeTo: 2, priceCents: 200 },
    ];
    expect(findTier(tiers, 2)?.priceCents).toBe(200);
  });

  it('returns null when no tier covers the size', () => {
    expect(findTier(GYM_ABC_TIERS, 1)).toBeNull();
  });

  it('matches the open-ended tier above its lower bound', () => {
    expect(findTier(GYM_ABC_TIERS, 9)?.priceCents).toBe(350_000);
  });
});

describe('priceForSize', () => {
  it('ignores tiers for a flat plan', () => {
    const result = priceForSize({
      pricingModel: 'flat',
      basePriceCents: 100_000,
      tiers: GYM_ABC_TIERS,
      size: 4,
    });
    expect(result.totalCents).toBe(100_000);
    expect(result.basis).toBe('base');
  });

  it('charges the couple rate for two, not twice the solo rate', () => {
    const result = priceForSize({
      pricingModel: 'flat_by_size',
      basePriceCents: 100_000,
      tiers: GYM_ABC_TIERS,
      size: 2,
    });
    expect(result.totalCents).toBe(180_000);
    expect(result.basis).toBe('tier_total');
  });

  it('charges the family rate for four', () => {
    const result = priceForSize({
      pricingModel: 'flat_by_size',
      basePriceCents: 100_000,
      tiers: GYM_ABC_TIERS,
      size: 4,
    });
    expect(result.totalCents).toBe(350_000);
  });

  it('falls back to the base price when no tier covers the size', () => {
    const result = priceForSize({
      pricingModel: 'flat_by_size',
      basePriceCents: 100_000,
      tiers: GYM_ABC_TIERS,
      size: 1,
    });
    expect(result.totalCents).toBe(100_000);
    expect(result.tier).toBeNull();
  });

  it('multiplies the per-head rate by the group size', () => {
    const perHead: PriceTier[] = [
      { sizeFrom: 1, sizeTo: 1, priceCents: 100_000 },
      { sizeFrom: 2, sizeTo: 2, priceCents: 90_000 },
      { sizeFrom: 3, sizeTo: null, priceCents: 80_000 },
    ];
    const result = priceForSize({
      pricingModel: 'per_head_by_size',
      basePriceCents: 100_000,
      tiers: perHead,
      size: 4,
    });
    expect(result.totalCents).toBe(320_000);
    expect(result.basis).toBe('tier_per_head');
  });

  it('treats a size below one as a single member', () => {
    const result = priceForSize({
      pricingModel: 'flat_by_size',
      basePriceCents: 100_000,
      tiers: GYM_ABC_TIERS,
      size: 0,
    });
    expect(result.totalCents).toBe(100_000);
  });
});
