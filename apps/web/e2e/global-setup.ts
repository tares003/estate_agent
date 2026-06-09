import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

// Playwright global setup: stand up a real PostgreSQL 16 + PostGIS the dev server
// queries during the e2e run. A FIXED container name + host port make the
// DATABASE_URL deterministic for the webServer (playwright.config.ts) and let
// global-teardown remove the container by name. Ryuk is disabled — we own cleanup.
process.env['TESTCONTAINERS_RYUK_DISABLED'] = 'true';

export const E2E_DB_URL = 'postgresql://test:test@localhost:5433/estate_test';
export const E2E_CONTAINER = 'estate-e2e-pg';
const DEV_TENANT = '00000000-0000-0000-0000-000000000001'; // matches middleware's dev fallback

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const dbPkg = join(repoRoot, 'packages', 'db');
const rawDir = join(dbPkg, 'migrations', 'raw');
const MIGRATIONS = [
  '0001_postgis.sql',
  '0002_rls_policies.sql',
  '0003_core_entities_rls.sql',
  '0004_property_postgis.sql',
  '0005_satellite_rls.sql',
  '0006_composite_tenant_fks.sql',
];

const SEED = [
  {
    slug: 'palatine-road-didsbury-m20',
    title: 'Edwardian semi · 4 bed',
    address: 'Palatine Road, Didsbury',
    sale: 'sale',
    status: 'for_sale',
    price: 52_500_000,
    beds: 4,
    lat: 53.41,
    lon: -2.23,
  },
  {
    slug: 'ellesmere-street-castlefield-m15',
    title: 'Canalside apartment · 2 bed',
    address: 'Ellesmere Street, Castlefield',
    sale: 'rent',
    status: 'to_let',
    price: 145_000,
    beds: 2,
    lat: 53.47,
    lon: -2.25,
  },
];

/** Run a pnpm command in the db package with the e2e DATABASE_URL. */
function dbPkgExec(args: string[]): void {
  execFileSync('pnpm', ['--filter', '@estate/db', 'exec', ...args], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
}

export default async function globalSetup(): Promise<void> {
  // Remove any container left by an interrupted previous run (idempotent).
  try {
    execFileSync('docker', ['rm', '-f', E2E_CONTAINER], { stdio: 'ignore' });
  } catch {
    // none to remove — fine.
  }

  await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withName(E2E_CONTAINER)
    .withUsername('test')
    .withPassword('test')
    .withDatabase('estate_test')
    .withExposedPorts({ container: 5432, host: 5433 })
    .start();

  // Schema: the real Prisma schema + the generated client the app instantiates.
  dbPkgExec(['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']);
  dbPkgExec(['prisma', 'generate']);

  const pg = new Client({ connectionString: E2E_DB_URL });
  await pg.connect();
  try {
    for (const file of MIGRATIONS) {
      await pg.query(readFileSync(join(rawDir, file), 'utf8'));
    }
    await pg.query(
      `INSERT INTO platform_tenants (id, slug, name, created_at, updated_at)
       VALUES ($1, 'demo', 'Demo Agency', now(), now())`,
      [DEV_TENANT],
    );
    for (const p of SEED) {
      await pg.query(
        `INSERT INTO properties
           (id, tenant_id, reference, slug, title, display_address, postcode, town, sale_type,
            market_status, listing_type, price, bedrooms, bathrooms, latitude, longitude, geog,
            published_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $2, $3, $4, 'M20 2QR', 'Manchester', $5::sale_type,
            $6::market_status, 'residential', $7, $8, 2, $9, $10,
            ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography, now(), now(), now())`,
        [DEV_TENANT, p.slug, p.title, p.address, p.sale, p.status, p.price, p.beds, p.lat, p.lon],
      );
    }
  } finally {
    await pg.end();
  }
}
