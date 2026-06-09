import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Real PostgreSQL 16 + PostGIS integration suite (opt-in: `pnpm test:integration`,
// requires Docker). This is the "Testcontainers in CI" path the migrations' own
// comments reference — it does what pglite CANNOT: applies the actual schema +
// raw migrations to a real engine and verifies PostGIS radius search, RLS tenant
// isolation under a non-superuser role, and the composite tenant FKs (0006),
// including that 0006 correctly drops + replaces the Prisma-generated
// single-column FKs that `prisma db push` creates.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..'); // packages/db
const RAW = join(root, 'migrations', 'raw');

/** Skip the whole suite gracefully when Docker isn't reachable. */
function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['ps'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const DOCKER = dockerAvailable();

const MIGRATIONS = [
  '0001_postgis.sql',
  '0002_rls_policies.sql',
  '0003_core_entities_rls.sql',
  '0004_property_postgis.sql',
  '0005_satellite_rls.sql',
  '0006_composite_tenant_fks.sql',
];

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

// Three tenant-A properties: p1 (origin), p2 ~1.1km north of p1, p3 far away.
const LON = -0.1278;
const LAT = 51.5074;
const PROPS = [
  { slug: 'p1', lat: LAT, lon: LON },
  { slug: 'p2', lat: LAT + 0.01, lon: LON }, // ≈1.11km north
  { slug: 'p3', lat: 52.5, lon: -1.5 }, // hundreds of km away
];

describe.skipIf(!DOCKER)('real Postgres 16 + PostGIS (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let admin: Client; // superuser — bypasses RLS; used to push schema + seed
  let uri: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
      .withDatabase('estate_test')
      .start();
    uri = container.getConnectionUri();

    // 1) Create the full Prisma schema (tables, enums, indexes, and the
    //    single-column FKs that 0006 will drop + replace) via `prisma db push`.
    execFileSync(
      'pnpm',
      ['exec', 'prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: uri },
        stdio: 'ignore',
        shell: process.platform === 'win32',
      },
    );

    // 2) Layer the raw migrations (PostGIS ext, RLS, geog + trigger + GiST,
    //    composite tenant FKs) in numeric order. node-postgres' simple query
    //    protocol runs each multi-statement file (incl. the dollar-quoted trigger
    //    function in 0004) in one call.
    admin = new Client({ connectionString: uri });
    await admin.connect();
    for (const file of MIGRATIONS) {
      await admin.query(readFileSync(join(RAW, file), 'utf8'));
    }

    // A non-privileged role to exercise RLS (superusers bypass it).
    await admin.query(`
      CREATE ROLE app_user NOLOGIN;
      GRANT USAGE ON SCHEMA public TO app_user;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    `);

    // Seed two tenants + the geocoded properties (as superuser → RLS bypassed).
    // `updated_at` is @updatedAt (NOT NULL, no DB default — Prisma sets it in the
    // client), so a raw INSERT must supply it.
    await admin.query(
      `INSERT INTO platform_tenants (id, slug, name, created_at, updated_at)
       VALUES ($1,'a','Tenant A', now(), now()),($2,'b','Tenant B', now(), now())`,
      [TENANT_A, TENANT_B],
    );
    for (const p of PROPS) {
      await admin.query(
        `INSERT INTO properties
           (id, tenant_id, reference, slug, display_address, postcode, sale_type, market_status,
            listing_type, price, bedrooms, latitude, longitude, published_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $2, 'Addr', 'SW1A 1AA', 'sale', 'for_sale',
            'residential', 50000000, 3, $3, $4, now(), now(), now())`,
        [TENANT_A, p.slug, p.lat, p.lon],
      );
    }
  });

  afterAll(async () => {
    await admin?.end();
    await container?.stop();
  });

  it('populates geog via the 0004 trigger and filters by ST_DWithin radius, ordered by distance', async () => {
    const point = `ST_SetSRID(ST_MakePoint(${LON}, ${LAT}), 4326)::geography`;

    const geocoded = await admin.query(
      `SELECT count(*)::int AS n FROM properties WHERE geog IS NOT NULL`,
    );
    expect(geocoded.rows[0].n).toBe(3); // the trigger geocoded every seeded row

    const within5km = await admin.query(
      `SELECT slug FROM properties WHERE ST_DWithin(geog, ${point}, 5000) ORDER BY geog <-> ${point}`,
    );
    expect(within5km.rows.map((r) => r.slug)).toEqual(['p1', 'p2']);

    const within500m = await admin.query(
      `SELECT slug FROM properties WHERE ST_DWithin(geog, ${point}, 500)`,
    );
    expect(within500m.rows.map((r) => r.slug)).toEqual(['p1']);
  });

  it('enforces tenant RLS as a non-superuser role (fail-closed when unset)', async () => {
    const u = new Client({ connectionString: uri });
    await u.connect();
    try {
      await u.query('SET ROLE app_user');

      await u.query(`SET app.current_tenant_id = '${TENANT_A}'`);
      const a = await u.query('SELECT count(*)::int AS n FROM properties');
      expect(a.rows[0].n).toBe(3);

      await u.query(`SET app.current_tenant_id = '${TENANT_B}'`);
      const b = await u.query('SELECT count(*)::int AS n FROM properties');
      expect(b.rows[0].n).toBe(0);

      await u.query('RESET app.current_tenant_id');
      const none = await u.query('SELECT count(*)::int AS n FROM properties');
      expect(none.rows[0].n).toBe(0);
    } finally {
      await u.end();
    }
  });

  it('rejects a cross-tenant enquiry.property_id via the composite FK (0006), even as superuser', async () => {
    const p1 = (await admin.query(`SELECT id FROM properties WHERE slug='p1'`)).rows[0]
      .id as string;

    // Same-tenant reference is accepted.
    await admin.query(
      `INSERT INTO enquiries (id, tenant_id, property_id, name, email, message, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'A', 'a@example.com', 'hi', now(), now())`,
      [TENANT_A, p1],
    );

    // Cross-tenant reference (tenant B → tenant A's property) is rejected by the
    // composite FK — RLS is bypassed for the superuser, so this proves the FK, not RLS.
    await expect(
      admin.query(
        `INSERT INTO enquiries (id, tenant_id, property_id, name, email, message, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'B', 'b@example.com', 'hi', now(), now())`,
        [TENANT_B, p1],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('confirms 0006 replaced the Prisma single-column FK with the composite one', async () => {
    const fks = await admin.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'enquiries'::regclass AND contype = 'f'`,
    );
    const names = fks.rows.map((r) => r.conname as string);
    expect(names).toContain('enquiries_tenant_property_fkey'); // composite added by 0006
    expect(names).not.toContain('enquiries_property_id_fkey'); // single-column dropped by 0006
  });
});
