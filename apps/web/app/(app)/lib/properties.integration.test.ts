import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { searchPropertiesNear, type PropertyRawClient } from './properties.js';

// Verifies the radius search (searchPropertiesNear) — its assembled ST_DWithin
// SQL — against a real PostgreSQL 16 + PostGIS engine (opt-in: requires Docker,
// `pnpm --filter @estate/web test:integration`). The unit test proves the SQL is
// built correctly; this proves the assembled query actually parses and runs on
// PostGIS (the ::enum casts, the `geog <-> point` distance order, the bound
// params) and returns the right rows nearest-first. A minimal self-contained
// schema (just the columns the radius query touches) keeps it focused.

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['ps'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const DOCKER = dockerAvailable();

const TENANT = '11111111-1111-1111-1111-111111111111';
const LON = -0.1278;
const LAT = 51.5074;
// p1 origin; p2 ≈1.1km north; p3 hundreds of km away.
const PROPS = [
  { slug: 'p1', lat: LAT, lon: LON, price: 50_000_000, beds: 3, sale: 'sale' },
  { slug: 'p2', lat: LAT + 0.01, lon: LON, price: 30_000_000, beds: 2, sale: 'rent' },
  { slug: 'p3', lat: 52.5, lon: -1.5, price: 90_000_000, beds: 5, sale: 'sale' },
];

describe.skipIf(!DOCKER)('searchPropertiesNear on real PostGIS (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pg: Client;
  let client: PropertyRawClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4').start();
    pg = new Client({ connectionString: container.getConnectionUri() });
    await pg.connect();

    // Minimal schema: just the enums + columns the radius query reads/selects.
    await pg.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
      CREATE TYPE sale_type AS ENUM ('sale','rent');
      CREATE TYPE listing_type AS ENUM ('residential','new_home','commercial','business_transfer','care_home','land');
      CREATE TYPE market_status AS ENUM ('for_sale','under_offer','sold_stc','sold','to_let','let_agreed','let','withdrawn');
      CREATE TABLE properties (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        reference text NOT NULL,
        slug text NOT NULL,
        display_address text NOT NULL,
        postcode text NOT NULL,
        title text,
        town text,
        sale_type sale_type NOT NULL,
        listing_type listing_type NOT NULL DEFAULT 'residential',
        market_status market_status NOT NULL DEFAULT 'for_sale',
        price int, bedrooms int, bathrooms int, receptions int,
        latitude float8, longitude float8,
        geog geography(Point, 4326),
        published_at timestamptz, deleted_at timestamptz
      );
    `);
    for (const p of PROPS) {
      await pg.query(
        `INSERT INTO properties
           (tenant_id, reference, slug, display_address, postcode, town, sale_type, price, bedrooms,
            latitude, longitude, geog, published_at)
         VALUES ($1, $2, $2, 'Addr', 'SW1A 1AA', 'London', $3::sale_type, $4, $5, $6, $7,
                 ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography, now())`,
        [TENANT, p.slug, p.sale, p.price, p.beds, p.lat, p.lon],
      );
    }

    // The adapter Prisma's tx satisfies in production: $queryRawUnsafe → pg rows.
    client = {
      $queryRawUnsafe: async <T>(sql: string, ...values: unknown[]): Promise<T> =>
        (await pg.query(sql, values)).rows as T,
    };
  });

  afterAll(async () => {
    await pg?.end();
    await container?.stop();
  });

  it('returns properties within the radius, nearest-first, with correct totals', async () => {
    const result = await searchPropertiesNear(client, {
      lat: LAT,
      lng: LON,
      radiusMetres: 5000,
    });
    expect(result.items.map((i) => i.href)).toEqual(['/properties/p1', '/properties/p2']);
    expect(result.total).toBe(2);
  });

  it('tightens to a 500m radius (p2 falls outside)', async () => {
    const result = await searchPropertiesNear(client, { lat: LAT, lng: LON, radiusMetres: 500 });
    expect(result.items.map((i) => i.href)).toEqual(['/properties/p1']);
    expect(result.total).toBe(1);
  });

  it('combines radius with the other filters (sale type + price)', async () => {
    const result = await searchPropertiesNear(client, {
      lat: LAT,
      lng: LON,
      radiusMetres: 5000,
      saleType: 'rent',
      priceMax: 40_000_000,
    });
    expect(result.items.map((i) => i.href)).toEqual(['/properties/p2']); // only the rental
    expect(result.total).toBe(1);
  });
});
