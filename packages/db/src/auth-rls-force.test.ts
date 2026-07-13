import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// Audit finding auth-tables-rls-not-forced-isolation-by-convention: 0012 left the
// four Better Auth adapter tables (sessions, accounts, verifications, two_factors)
// ENABLE-but-not-FORCE with no policy, so the table OWNER — the role the app's
// base Prisma client connects as — silently bypassed RLS and could read every
// tenant's session/token rows. The auth adapter itself never relied on the owner
// exemption: it connects through a dedicated BYPASSRLS role (AUTH_DATABASE_URL),
// which bypasses RLS irrespective of FORCE. 0023 therefore FORCEs RLS and attaches
// the standard GUC tenant_isolation policy so the owner is fail-closed, exactly
// like every other tenant table; the BYPASSRLS auth connection is unaffected.
//
// Asserts the 0023 migration text + the corrected 0012 comment, and exercises the
// owner-fail-closed / privileged-bypass pattern against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const forceRls = readFileSync(
  join(root, 'migrations', 'raw', '0023_better_auth_rls_force.sql'),
  'utf8',
);
const enableRls = readFileSync(
  join(root, 'migrations', 'raw', '0012_better_auth_tables.sql'),
  'utf8',
);

const AUTH_TABLES = ['sessions', 'accounts', 'verifications', 'two_factors'];

describe('0023 migration — FORCE RLS + tenant_isolation on the Better Auth tables', () => {
  it('forces RLS on all four auth tables (the owner is no longer exempt)', () => {
    for (const table of AUTH_TABLES) {
      expect(forceRls).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    }
  });

  it('attaches the standard GUC tenant_isolation policy to all four tables', () => {
    for (const table of AUTH_TABLES) {
      expect(forceRls).toContain(`CREATE POLICY tenant_isolation ON ${table}`);
    }
    expect(forceRls).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });

  it('documents why FORCE is safe: the auth adapter connects via BYPASSRLS', () => {
    expect(forceRls).toMatch(/BYPASSRLS/);
  });
});

describe('0012 migration — comment corrected (the owner exemption was never the bypass)', () => {
  it('no longer claims the un-FORCEd owner exemption is the intended privileged bypass', () => {
    expect(enableRls).not.toMatch(/exemption IS the intended privileged bypass/);
  });

  it('records that the auth adapter runs on a BYPASSRLS role and 0023 forces RLS', () => {
    expect(enableRls).toMatch(/BYPASSRLS/);
    expect(enableRls).toMatch(/0023/);
  });
});

describe('FORCE RLS on an auth table (pglite — mirrors 0023)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  // The table is created BY a non-superuser owner role (pglite connects as a
  // superuser, which always bypasses RLS) so that FORCE is what subjects the
  // owner to the policy — the exact posture the app's base client has in
  // production. The superuser then stands in for the BYPASSRLS auth connection.
  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE ROLE app_owner NOLOGIN;
      GRANT CREATE ON SCHEMA public TO app_owner;
      SET ROLE app_owner;
      CREATE TABLE sessions (tenant_id uuid NOT NULL, token text NOT NULL);
      ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON sessions
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    `);
    return db;
  }

  it('fails the OWNER closed: no GUC → no rows; wrong GUC → no rows', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO sessions (tenant_id, token) VALUES ('${TENANT_A}', 'tok-a')`);

    await db.exec(`RESET app.current_tenant_id`);
    const unset = await db.query<{ token: string }>(`SELECT token FROM sessions`);
    expect(unset.rows).toEqual([]);

    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const wrong = await db.query<{ token: string }>(`SELECT token FROM sessions`);
    expect(wrong.rows).toEqual([]);

    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    const own = await db.query<{ token: string }>(`SELECT token FROM sessions`);
    expect(own.rows).toEqual([{ token: 'tok-a' }]);
    await db.close();
  });

  it('blocks the OWNER writing a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO sessions (tenant_id, token) VALUES ('${TENANT_B}', 'smuggled')`),
    ).rejects.toThrow();
    await db.close();
  });

  it('leaves the privileged bypass connection unaffected (the auth adapter path)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO sessions (tenant_id, token) VALUES ('${TENANT_A}', 'tok-a')`);
    await db.exec(`RESET app.current_tenant_id`);
    // Back to the superuser — like a BYPASSRLS role, it is exempt from RLS even
    // when FORCEd, so the pre-session auth reads/writes keep working.
    await db.exec(`RESET ROLE`);
    const all = await db.query<{ token: string }>(`SELECT token FROM sessions`);
    expect(all.rows).toEqual([{ token: 'tok-a' }]);
    await db.close();
  });
});
