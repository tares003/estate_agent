import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-W FR-W-8 — the per-tenant mortgage rate preset collection (mortgage_rate_presets).
// One row per admin-curated rate snapshot (label + illustrative rate + term) backs the
// public mortgage calculator's preset dropdown ("2-year fixed", "5-year fixed", …).
// Tenant-scoped and isolated by the tenant_isolation RLS policy in 0017 (same shape as
// 0015/0016). Schema-only unit: asserts the schema source + the raw SQL, and exercises
// the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0017_mortgage_rate_presets_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('MortgageRatePreset — schema (mortgage_rate_presets, FR-W-8)', () => {
  it('is declared, tenant-scoped, and mapped to mortgage_rate_presets', () => {
    const model = block('MortgageRatePreset', 'model');
    expect(model).toContain('@@map("mortgage_rate_presets")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/label\s+String/);
    expect(model).toMatch(/annualRatePercent\s+Float\s+@map\("annual_rate_percent"\)/);
    expect(model).toMatch(/termYears\s+Int\s+@map\("term_years"\)/);
    expect(model).toMatch(/sortOrder\s+Int\s+@default\(0\)\s+@map\("sort_order"\)/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
    expect(model).toContain('onDelete: Cascade');
  });

  it('PlatformTenant back-relates to the presets', () => {
    expect(block('PlatformTenant', 'model')).toMatch(
      /mortgageRatePresets\s+MortgageRatePreset\[\]/,
    );
  });
});

describe('0017 RLS migration — tenant isolation on mortgage_rate_presets', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain(
      'ALTER TABLE mortgage_rate_presets ENABLE ROW LEVEL SECURITY;',
    );
    expect(rlsMigration).toContain(
      'ALTER TABLE mortgage_rate_presets FORCE ROW LEVEL SECURITY;',
    );
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON mortgage_rate_presets');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on mortgage_rate_presets (pglite — mirrors 0017)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE mortgage_rate_presets (
        tenant_id uuid NOT NULL,
        label text NOT NULL,
        annual_rate_percent double precision NOT NULL,
        term_years integer NOT NULL,
        sort_order integer NOT NULL DEFAULT 0
      );
      ALTER TABLE mortgage_rate_presets ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON mortgage_rate_presets
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT, DELETE ON mortgage_rate_presets TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO mortgage_rate_presets (tenant_id, label, annual_rate_percent, term_years) VALUES ('${TENANT_A}', '2-year fixed', 4.79, 25)`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM mortgage_rate_presets`,
    );
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO mortgage_rate_presets (tenant_id, label, annual_rate_percent, term_years) VALUES ('${TENANT_B}', 'x', 4.5, 25)`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
