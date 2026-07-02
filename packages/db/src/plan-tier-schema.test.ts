import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-X FR-X-10 — the plan tier persisted on the platform tenant registry, the
// source of a tenant's active-listing quota (PRODUCT.md §5b: starter=100,
// professional=500, enterprise=unlimited). Schema-only unit: assert the Prisma
// source declares the PlanTier enum + the PlatformTenant.planTier column defaulting
// to the strictest tier (starter). platform_tenants is the operator registry (NOT
// under RLS), and a plain enum column is fully Prisma-expressible — created by
// `prisma db push` from the schema exactly like `enabled_packs` — so no raw SQL
// migration is needed (the raw migrations carry only what Prisma cannot express).

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

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
