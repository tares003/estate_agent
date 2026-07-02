// pack: core — plan-tier active-listing quota is core metering infrastructure
// (PRODUCT.md §5b/§5 metering), not gated behind any optional pack.
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_LISTING_QUOTA,
  getActiveListingQuota,
  PLAN_TIERS,
  resolvePlanTier,
} from './plan-quotas.js';

// EPIC-X FR-X-10 — a bulk import may not push a tenant past their plan tier's
// active-listing quota (PRODUCT.md §5b / "Tier inclusions and metering"):
//   starter = 100, professional = 500, enterprise = unlimited.
// These are pure, DB-free helpers: the tier -> cap map, and a defensive
// normaliser that resolves an arbitrary value to a known tier (defaulting to the
// STRICTEST tier, starter, so an unknown/absent tier fails closed on quota).

describe('PLAN_TIERS', () => {
  it('lists exactly the three plan codes in ascending order', () => {
    expect(PLAN_TIERS).toEqual(['starter', 'professional', 'enterprise']);
  });
});

describe('getActiveListingQuota', () => {
  it('caps a Starter tenant at 100 active listings', () => {
    expect(getActiveListingQuota('starter')).toBe(100);
  });

  it('caps a Professional tenant at 500 active listings', () => {
    expect(getActiveListingQuota('professional')).toBe(500);
  });

  it('gives an Enterprise tenant an unlimited (Infinity) quota', () => {
    expect(getActiveListingQuota('enterprise')).toBe(Infinity);
  });

  it('reads from the ACTIVE_LISTING_QUOTA table (single source of truth)', () => {
    expect(getActiveListingQuota('starter')).toBe(ACTIVE_LISTING_QUOTA.starter);
    expect(getActiveListingQuota('professional')).toBe(ACTIVE_LISTING_QUOTA.professional);
    expect(getActiveListingQuota('enterprise')).toBe(ACTIVE_LISTING_QUOTA.enterprise);
  });
});

describe('resolvePlanTier', () => {
  it('passes a valid tier through unchanged', () => {
    expect(resolvePlanTier('professional')).toBe('professional');
    expect(resolvePlanTier('enterprise')).toBe('enterprise');
  });

  it('defaults an unknown tier to the strictest tier (starter)', () => {
    expect(resolvePlanTier('galactic')).toBe('starter');
  });

  it('defaults null / undefined to starter (fail-closed on quota)', () => {
    expect(resolvePlanTier(null)).toBe('starter');
    expect(resolvePlanTier(undefined)).toBe('starter');
  });

  it('normalises case and surrounding whitespace', () => {
    expect(resolvePlanTier('  Professional ')).toBe('professional');
  });
});
