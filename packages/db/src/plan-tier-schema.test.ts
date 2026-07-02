import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-X FR-X-10 — the plan tier persisted on the platform tenant registry, the
// source of a tenant's active-listing quota (PRODUCT.md §5b: starter=100,
// professional=500, enterprise=unlimited). Schema-only unit: assert the Prisma
// source declares the PlanTier enum + the PlatformTenant.planTier column defaulting
// to the strictest tier (starter), and that the raw migration adds the enum type +
// column. platform_tenants is the operator registry (NOT under RLS), so no RLS
// policy change is needed for this column.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const migration = readFileSync(join(root, 'migrations', 'raw', '0023_plan_tier.sql'), 'utf8');

function block(name: string): string {
  const match = schema.match(new RegExp(`${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('PlanTier enum (PRODUCT.md §5b tier codes)', () => {
  it('declares the enum mapped to plan_tier', () => {
    expect(schema).toMatch(/enum PlanTier \{/);
    expect(block('enum PlanTier')).toContain('@@map("plan_tier")');
  });

  it('carries exactly the three canonical tier codes', () => {
    const enumBlock = block('enum PlanTier');
    for (const tier of ['starter', 'professional', 'enterprise']) {
      expect(enumBlock).toMatch(new RegExp(`\\b${tier}\\b`));
    }
  });
});

describe('PlatformTenant.planTier column', () => {
  it('adds a planTier field defaulting to starter, mapped to plan_tier', () => {
    const tenant = block('model PlatformTenant');
    expect(tenant).toMatch(/planTier\s+PlanTier\s+@default\(starter\)\s+@map\("plan_tier"\)/);
  });
});

describe('0023 plan-tier migration', () => {
  it('creates the plan_tier enum type', () => {
    expect(migration).toMatch(/CREATE TYPE plan_tier/i);
    for (const tier of ['starter', 'professional', 'enterprise']) {
      expect(migration).toMatch(new RegExp(`'${tier}'`));
    }
  });

  it('adds the plan_tier column to platform_tenants defaulting to starter', () => {
    expect(migration).toMatch(/ALTER TABLE platform_tenants/i);
    expect(migration).toMatch(/ADD COLUMN[\s\S]*plan_tier/i);
    expect(migration).toMatch(/DEFAULT 'starter'/i);
  });
});
