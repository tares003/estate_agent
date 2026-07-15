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
const require = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Client } = require('pg');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DB_PKG = join(ROOT, 'packages', 'db');
const RAW = join(DB_PKG, 'migrations', 'raw');

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://estate:estate@localhost:5461/estate';

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
  console.log(
    '[dev-db] schema already present — skipping db push (reset the volume for schema changes)',
  );
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
  [
    '0001',
    'DEV-001',
    'residential',
    'sale',
    'house',
    'Edwardian semi with south-facing garden',
    '14 Palatine Road',
    'M20 3JJ',
    'Didsbury',
    525000,
    4,
    2,
    53.4225,
    -2.2312,
    false,
    30,
  ],
  [
    '0002',
    'DEV-002',
    'residential',
    'sale',
    'flat',
    'Two-bed apartment in converted mill',
    '3 Ellesmere Street',
    'M15 4JY',
    'Castlefield',
    285000,
    2,
    2,
    53.4721,
    -2.2622,
    false,
    12,
  ],
  [
    '0003',
    'DEV-003',
    'residential',
    'rent',
    'flat',
    'Furnished city-centre one-bed',
    '88 Deansgate',
    'M3 2ER',
    'Manchester',
    1150,
    1,
    1,
    53.4794,
    -2.2453,
    false,
    5,
  ],
  [
    '0004',
    'DEV-004',
    'new_home',
    'sale',
    'house',
    'Plot 7, The Sycamores',
    'Sycamore Gardens',
    'M21 7QB',
    'Chorlton',
    465000,
    3,
    2,
    53.4426,
    -2.2769,
    true,
    2,
  ],
  [
    '0005',
    'DEV-005',
    'residential',
    'sale',
    'bungalow',
    'Detached bungalow near the park',
    '2 Marle Avenue',
    'M33 5DP',
    'Sale',
    395000,
    3,
    1,
    53.4241,
    -2.3282,
    false,
    60,
  ],
  [
    '0006',
    'DEV-006',
    'residential',
    'rent',
    'house',
    'Three-bed family home, unfurnished',
    '41 Burton Road',
    'M20 1HB',
    'West Didsbury',
    1650,
    3,
    1,
    53.4302,
    -2.2431,
    false,
    1,
  ],
];

for (const p of PROPERTIES) {
  const [
    suffix,
    reference,
    listingType,
    saleType,
    category,
    title,
    address,
    postcode,
    town,
    priceGBP,
    beds,
    baths,
    lat,
    lng,
    isNewHome,
    daysAgo,
  ] = p;
  const slug = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${postcode.split(' ')[0].toLowerCase()}`;
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

/**
 * §F Material Information + descriptions for the detail page (deterministic demo
 * fixtures; CLAUDE.md §8 permits AI-authored seed data). Keyed by id suffix.
 * ground_rent / service_charge are in PENCE (money columns), like price.
 */
const DETAILS = {
  '0001': {
    sqft: 1680,
    receptions: 2,
    tenure: 'freehold',
    ctax: 'e',
    epc: 'd',
    epcScore: 62,
    featured: true,
    furnished: null,
    groundRent: null,
    serviceCharge: null,
    short:
      'A handsome four-bedroom Edwardian semi with a south-facing garden, a short walk from Didsbury village.',
    desc: 'This substantial period semi keeps its Edwardian character (deep skirtings, picture rails, two cast-iron fireplaces) while working comfortably as a modern family home. The ground floor runs from a bay-fronted sitting room through to an open kitchen and dining space that opens onto the garden.\n\nUpstairs are four genuine double bedrooms and a family bathroom, with a re-fitted shower room on the return. The loft is boarded and lit, ready to convert (subject to consent).',
    area: 'Didsbury pairs a village high street of independent cafes and delis with quick trams into the city. Well-regarded primary and secondary schools sit within the catchment, and Fletcher Moss park and the Mersey trails are minutes away on foot.',
    features: [
      'Four double bedrooms',
      'South-facing garden',
      'Two period reception rooms',
      'Off-street parking for two',
      'Re-roofed in 2023',
      'Catchment for sought-after schools',
    ],
  },
  '0002': {
    sqft: 760,
    receptions: 1,
    tenure: 'leasehold',
    ctax: 'c',
    epc: 'c',
    epcScore: 74,
    featured: true,
    furnished: null,
    groundRent: 25000,
    serviceCharge: 180000,
    short:
      'A two-bedroom apartment in a landmark converted mill, moments from the Castlefield basin.',
    desc: 'Set within a Grade II converted cotton mill, this apartment leads with exposed brick, cast-iron columns and tall industrial windows that flood the living space with light. The kitchen is integrated and the principal bedroom has its own en suite.\n\nThe building is secure with a lift and a residents-only courtyard, and the canal towpath is on the doorstep.',
    area: "Castlefield is the city's quiet quarter: canal basins, converted warehouses and the Roman fort, with Deansgate and Spinningfields a short walk for work and dining.",
    features: [
      'Grade II converted mill',
      'Exposed brick and ironwork',
      'En suite to principal bedroom',
      'Secure entry and lift',
      'Residents courtyard',
      'Canalside setting',
    ],
  },
  '0003': {
    sqft: 520,
    receptions: 1,
    tenure: 'leasehold',
    ctax: 'b',
    epc: 'b',
    epcScore: 83,
    featured: false,
    furnished: 'furnished',
    groundRent: null,
    serviceCharge: null,
    short: 'A furnished one-bedroom apartment on Deansgate, ready to move straight into.',
    desc: 'A bright, efficiently laid-out one-bedroom apartment, fully furnished to a good standard and available now. Floor-to-ceiling glazing frames the city, and the open kitchen is fitted with integrated appliances.\n\nResidents share a concierge, a gym and a roof terrace.',
    area: 'Deansgate puts the whole city within a ten-minute walk: bars, restaurants, the arena and two rail stations.',
    features: [
      'Fully furnished',
      'Floor-to-ceiling glazing',
      'Concierge and gym',
      'Shared roof terrace',
      'Integrated appliances',
      'Available now',
    ],
  },
  '0004': {
    sqft: 1180,
    receptions: 2,
    tenure: 'freehold',
    ctax: 'unknown',
    epc: 'b',
    epcScore: 86,
    featured: true,
    furnished: null,
    groundRent: null,
    serviceCharge: null,
    short: 'A brand-new three-bedroom home at The Sycamores, built to an A/B energy standard.',
    desc: 'Plot 7 is a three-bedroom home on a small, low-density development in Chorlton. Built to current standards, it comes with an air-source heat pump, underfloor heating to the ground floor and a ten-year structural warranty.\n\nThe open-plan kitchen and dining room opens to a turfed rear garden, and there are two allocated parking spaces.',
    area: 'Chorlton is known for its independent shops, weekend markets and green spaces, with Metrolink links into the city.',
    features: [
      'Brand new, ten-year warranty',
      'Air-source heat pump',
      'Underfloor heating downstairs',
      'Two allocated parking spaces',
      'Turfed rear garden',
      'Help to Buy considered',
    ],
  },
  '0005': {
    sqft: 1090,
    receptions: 2,
    tenure: 'freehold',
    ctax: 'd',
    epc: 'e',
    epcScore: 54,
    featured: false,
    furnished: null,
    groundRent: null,
    serviceCharge: null,
    short: 'A detached three-bedroom bungalow with generous gardens, backing onto the park.',
    desc: 'A rarely available detached bungalow offering single-level living with scope to extend or convert the loft (subject to consent). Two reception rooms sit either side of the hall, and the kitchen looks over the rear garden.\n\nThe plot is a real feature: wide frontage with a driveway, and a deep rear garden that backs directly onto Worthington Park.',
    area: 'Sale offers a traditional town centre, a Metrolink stop and the Bridgewater Canal, with the Trafford Centre a short drive away.',
    features: [
      'Detached bungalow',
      'Backs onto the park',
      'Two reception rooms',
      'Driveway and garage',
      'Scope to extend',
      'No onward chain',
    ],
  },
  '0006': {
    sqft: 1020,
    receptions: 2,
    tenure: 'freehold',
    ctax: 'c',
    epc: 'c',
    epcScore: 71,
    featured: false,
    furnished: 'unfurnished',
    groundRent: null,
    serviceCharge: null,
    short: 'An unfurnished three-bedroom family home to rent in West Didsbury.',
    desc: 'A well-proportioned three-bedroom terrace offered unfurnished and available for a long let. The two reception rooms give flexible living space, and the kitchen extends across the rear with room for a table.\n\nThere is an enclosed rear yard and on-street permit parking.',
    area: "West Didsbury's Burton Road is lined with delis, bars and bistros, with the tram and Withington hospital close by.",
    features: [
      'Unfurnished, long let',
      'Two reception rooms',
      'Three bedrooms',
      'Enclosed rear yard',
      'Burton Road on the doorstep',
      'Available now',
    ],
  },
};

for (const p of PROPERTIES) {
  const suffix = p[0];
  const d = DETAILS[suffix];
  if (!d) continue;
  await client.query(
    `UPDATE properties SET
       short_description = $2, description = $3, area_description = $4,
       key_features = $5::jsonb, tenure = $6::tenure,
       council_tax_band = $7::council_tax_band, epc_rating = $8::epc_rating,
       epc_score = $9, ground_rent = $10, service_charge = $11,
       furnished_status = $12::furnished_status, internal_sqft = $13,
       receptions = $14, is_featured = $15, updated_at = now()
     WHERE id = $1`,
    [
      `dddddddd-dddd-dddd-dddd-00000000${suffix}`,
      d.short,
      d.desc,
      d.area,
      JSON.stringify(d.features),
      d.tenure,
      d.ctax,
      d.epc,
      d.epcScore,
      d.groundRent,
      d.serviceCharge,
      d.furnished,
      d.sqft,
      d.receptions,
      d.featured,
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
