import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// Verifies the tenant-isolation policy pattern from
// migrations/raw/0002_rls_policies.sql against pglite (in-process Postgres — no
// Docker). The real schema's RLS policies use this exact USING/WITH CHECK shape.
//
// RLS is bypassed by superusers and table owners; pglite connects as a
// superuser, so the test runs its tenant operations under a dedicated
// non-privileged `app_user` role (SET ROLE) — which is also the least-privilege
// shape the production app should connect with. Full Prisma-against-PostgreSQL
// + PostGIS integration runs via Testcontainers in CI.

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const TENANT_C = '33333333-3333-3333-3333-333333333333';

async function setupWidgets(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE widgets (tenant_id uuid NOT NULL, label text NOT NULL);
    ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON widgets
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    CREATE ROLE app_user NOLOGIN;
    GRANT SELECT, INSERT ON widgets TO app_user;
  `);
  // All subsequent statements run as the non-privileged role so RLS applies.
  await db.exec(`SET ROLE app_user`);
  return db;
}

async function labelsFor(db: PGlite, tenantId: string): Promise<string[]> {
  await db.exec(`SET app.current_tenant_id = '${tenantId}'`);
  const result = await db.query<{ label: string }>(`SELECT label FROM widgets ORDER BY label`);
  return result.rows.map((row) => row.label);
}

describe('RLS tenant isolation (pglite — mirrors 0002_rls_policies.sql)', () => {
  it('admits only rows whose tenant_id matches app.current_tenant_id', async () => {
    const db = await setupWidgets();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO widgets (tenant_id, label) VALUES ('${TENANT_A}','a1'), ('${TENANT_A}','a2')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    await db.exec(`INSERT INTO widgets (tenant_id, label) VALUES ('${TENANT_B}','b1')`);

    expect(await labelsFor(db, TENANT_A)).toEqual(['a1', 'a2']);
    expect(await labelsFor(db, TENANT_B)).toEqual(['b1']);
    expect(await labelsFor(db, TENANT_C)).toEqual([]);

    await db.close();
  });

  it('blocks writing a row for a tenant other than the current GUC (WITH CHECK)', async () => {
    const db = await setupWidgets();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO widgets (tenant_id, label) VALUES ('${TENANT_B}','smuggled')`),
    ).rejects.toThrow();
    await db.close();
  });

  it('shows no rows when the tenant GUC is unset (fail-closed)', async () => {
    const db = await setupWidgets();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO widgets (tenant_id, label) VALUES ('${TENANT_A}','a1')`);
    await db.exec(`RESET app.current_tenant_id`);
    const rows = await db.query<{ label: string }>(`SELECT label FROM widgets`);
    expect(rows.rows).toEqual([]);
    await db.close();
  });
});
