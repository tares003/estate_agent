// Local dev database provisioning — mirrors the Testcontainers integration
// setup (packages/db/src/real-postgres.integration.test.ts):
//
//   1. Wait for the compose Postgres (infrastructure/dev/docker-compose.yml).
//   2. `prisma db push` creates the full Prisma schema (tables, enums, indexes).
//   3. The raw migrations (PostGIS ext, RLS policies, geog trigger, composite
//      tenant FKs, ...) are layered in numeric order, tracked in a
//      `_dev_migrations` ledger so re-runs only apply new files.
//   4. A deterministic dev seed: the DEV tenant the proxy falls back to on
//      localhost (apps/web/proxy.ts DEV_TENANT_ID) plus a handful of published
//      properties so the catalogue renders. Idempotent (ON CONFLICT DO NOTHING).
//
// Usage:  node infrastructure/dev/setup-dev-db.mjs
// Env:    DATABASE_URL (default postgresql://estate:estate@localhost:5461/estate)

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve `pg` from packages/db's dependency tree (pnpm does not hoist it to root).
const require = createRequire(
  new URL('../../packages/db/package.json', import.meta.url),
);
const { Client } = require('pg');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DB_PKG = join(ROOT, 'packages', 'db');
const RAW = join(DB_PKG, 'migrations', 'raw');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://estate:estate@localhost:5461/estate';

/** The tenant id apps/web/proxy.ts falls back to for non-tenant hosts in dev. */
const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function connectWithRetry(attempts = 30) {
  for (let i = 1; i <= attempts; i += 1) {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => {});
      if (i === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('unreachable');
}

console.log(`[dev-db] waiting for Postgres at ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')} ...`);
const client = await connectWithRetry();
console.log('[dev-db] connected');

// 0) The migration ledger lives in a SEPARATE schema. `prisma db push
//    --accept-data-loss` drops any table in `public` that is not in the Prisma
//    schema — including a ledger kept there — which would make re-runs replay the
//    non-idempotent RLS migrations (CREATE POLICY fails on a second pass). A
//    `_dev_meta` schema is outside Prisma's management, so the ledger survives.
await client.query('CREATE SCHEMA IF NOT EXISTS _dev_meta');
await client.query(
  'CREATE TABLE IF NOT EXISTS _dev_meta.migrations (file text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
);
// One-time move of any legacy public ledger into the safe schema, then drop it
// (the INSERT throws harmlessly on a fresh install where the legacy table is absent).
await client
  .query(
    `INSERT INTO _dev_meta.migrations (file)
       SELECT file FROM public._dev_migrations ON CONFLICT DO NOTHING`,
  )
  .catch(() => {});
await client.query('DROP TABLE IF EXISTS public._dev_migrations').catch(() => {});

// 1) Full Prisma schema via db push — but ONLY on a fresh database. Once the
//    PostGIS raw migration (0004) has run, `db push --accept-data-loss` sees the
//    extension-managed objects (spatial_ref_sys, the geography column) as "not in
//    the Prisma schema" and errors trying to drop them. The integration suite
//    avoids this by pushing exactly once on a fresh container; we mirror that.
//    A Prisma-schema (column) change therefore needs a volume reset:
//      docker compose -f infrastructure/dev/docker-compose.yml down -v && up -d
const fresh =
  (await client.query("SELECT to_regclass('public.properties') AS t")).rows[0].t === null;
if (fresh) {
  console.log('[dev-db] prisma db push (fresh database) ...');
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: DB_PKG,
    env: { ...process.env, DATABASE_URL },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} else {
  console.log('[dev-db] schema already present — skipping db push (reset the volume for schema changes)');
}

// 2) Raw migrations in numeric order, ledgered for idempotency in `_dev_meta`
//    (the files themselves are not re-runnable: CREATE POLICY etc. fail twice).
const applied = new Set(
  (await client.query('SELECT file FROM _dev_meta.migrations')).rows.map((row) => row.file),
);
const files = readdirSync(RAW)
  .filter((file) => file.endsWith('.sql'))
  .sort();
for (const file of files) {
  if (applied.has(file)) continue;
  console.log(`[dev-db] applying ${file} ...`);
  await client.query(readFileSync(join(RAW, file), 'utf8'));
  await client.query('INSERT INTO _dev_meta.migrations (file) VALUES ($1)', [file]);
}

// 3) Deterministic dev seed (idempotent). The compose superuser bypasses RLS.
console.log('[dev-db] seeding dev tenant + properties ...');
await client.query(
  `INSERT INTO platform_tenants (id, slug, name, created_at, updated_at)
   VALUES ($1, 'dev', 'Dev Estate Agency', now(), now())
   ON CONFLICT DO NOTHING`,
  [DEV_TENANT_ID],
);

/** Deterministic fixtures (CLAUDE.md §8): stable ids/slugs so re-runs are no-ops. */
const PROPERTIES = [
  // [id-suffix, reference, listingType, saleType, category, title, address, postcode, town, priceGBP, beds, baths, lat, lng, isNewHome, daysAgo]
  ['0001', 'DEV-001', 'residential', 'sale', 'house', 'Edwardian semi with south-facing garden', '14 Palatine Road', 'M20 3JJ', 'Didsbury', 525000, 4, 2, 53.4225, -2.2312, false, 30],
  ['0002', 'DEV-002', 'residential', 'sale', 'flat', 'Two-bed apartment in converted mill', '3 Ellesmere Street', 'M15 4JY', 'Castlefield', 285000, 2, 2, 53.4721, -2.2622, false, 12],
  ['0003', 'DEV-003', 'residential', 'rent', 'flat', 'Furnished city-centre one-bed', '88 Deansgate', 'M3 2ER', 'Manchester', 1150, 1, 1, 53.4794, -2.2453, false, 5],
  ['0004', 'DEV-004', 'new_home', 'sale', 'house', 'Plot 7, The Sycamores', 'Sycamore Gardens', 'M21 7QB', 'Chorlton', 465000, 3, 2, 53.4426, -2.2769, true, 2],
  ['0005', 'DEV-005', 'residential', 'sale', 'bungalow', 'Detached bungalow near the park', '2 Marle Avenue', 'M33 5DP', 'Sale', 395000, 3, 1, 53.4241, -2.3282, false, 60],
  ['0006', 'DEV-006', 'residential', 'rent', 'house', 'Three-bed family home, unfurnished', '41 Burton Road', 'M20 1HB', 'West Didsbury', 1650, 3, 1, 53.4302, -2.2431, false, 1],
];

for (const p of PROPERTIES) {
  const [suffix, reference, listingType, saleType, category, title, address, postcode, town, priceGBP, beds, baths, lat, lng, isNewHome, daysAgo] = p;
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${postcode.split(' ')[0].toLowerCase()}`;
  await client.query(
    `INSERT INTO properties (
       id, tenant_id, reference, listing_type, sale_type, market_status,
       is_new_home, category, slug, title, display_address, postcode, town,
       price, bedrooms, bathrooms, latitude, longitude,
       published_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4::listing_type, $5::sale_type, $6::market_status,
       $7, $8::property_category, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18,
       now() - ($19 || ' days')::interval, now(), now()
     )
     ON CONFLICT DO NOTHING`,
    [
      `dddddddd-dddd-dddd-dddd-00000000${suffix}`,
      DEV_TENANT_ID,
      reference,
      listingType,
      saleType,
      saleType === 'rent' ? 'to_let' : 'for_sale',
      isNewHome,
      category,
      slug,
      title,
      address,
      postcode,
      town,
      priceGBP * 100, // the price column stores PENCE
      beds,
      baths,
      lat,
      lng,
      String(daysAgo),
    ],
  );
}

const counts = await client.query(
  `SELECT (SELECT count(*) FROM platform_tenants) AS tenants,
          (SELECT count(*) FROM properties) AS properties`,
);
console.log(
  `[dev-db] done — tenants: ${counts.rows[0].tenants}, properties: ${counts.rows[0].properties}`,
);
await client.end();
