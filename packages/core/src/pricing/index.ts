/**
 * Plan pricing by group size.
 *
 * The price a family pays is not the solo price times the head count — that is
 * the whole point of the tier table. Getting this wrong silently overcharges or
 * undercharges every family on the plan, so it lives here as a pure function
 * with tests rather than inline in a route.
 */

import * as Money from '../money/index';

export type PricingModel = 'flat' | 'flat_by_size' | 'per_head_by_size';

export interface PriceTier {
  sizeFrom: number;
  /** null means "this size and above". */
  sizeTo: number | null;
  priceCents: number;
}

export interface PriceInput {
  pricingModel: PricingModel;
  basePriceCents: number;
  tiers: PriceTier[];
  /** Number of members the subscription will cover. Must be at least 1. */
  size: number;
}

export interface PriceResult {
  totalCents: Money.Cents;
  /** Which rule produced the number, so a UI can explain it. */
  basis: 'base' | 'tier_total' | 'tier_per_head';
  tier: PriceTier | null;
}

export function findTier(tiers: PriceTier[], size: number): PriceTier | null {
  // Most specific first: a bounded tier beats an open-ended one covering the
  // same size, which is what makes "3 or more" a fallback rather than a winner.
  const matches = tiers.filter(
    (t) => size >= t.sizeFrom && (t.sizeTo === null || size <= t.sizeTo),
  );
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aOpen = a.sizeTo === null ? 1 : 0;
    const bOpen = b.sizeTo === null ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.sizeFrom - a.sizeFrom;
  });
  return matches[0] ?? null;
}

export function priceForSize(input: PriceInput): PriceResult {
  const size = Math.max(1, Math.trunc(input.size));

  if (input.pricingModel === 'flat') {
    return { totalCents: Money.cents(input.basePriceCents), basis: 'base', tier: null };
  }

  const tier = findTier(input.tiers, size);
  if (!tier) {
    // No tier covers this size — fall back to the plan's own price rather than
    // inventing one. A missing tier is a configuration gap, not a licence to
    // guess at what a family should pay.
    return { totalCents: Money.cents(input.basePriceCents), basis: 'base', tier: null };
  }

  if (input.pricingModel === 'flat_by_size') {
    return { totalCents: Money.cents(tier.priceCents), basis: 'tier_total', tier };
  }

  return {
    totalCents: Money.multiply(Money.cents(tier.priceCents), size),
    basis: 'tier_per_head',
    tier,
  };
}
