import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// §J / EPIC-J — core (always-on) catalogue + CRM entity schema verification.
//
// This unit is schema-only (no src consumers land here per the cross-cutting
// "schema lands first" rule), so the tests assert against the Prisma schema
// source text and the raw SQL migrations rather than a generated client. The
// RLS pattern is additionally exercised against pglite (in-process Postgres),
// mirroring src/rls.test.ts, to prove the new tenant_isolation policies admit
// only matching-tenant rows. PostGIS is unavailable in pglite, so the spatial
// migration is asserted structurally (the Testcontainers path in CI runs it
// against real PostgreSQL + PostGIS).

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0003_core_entities_rls.sql'),
  'utf8',
);
const postgisMigration = readFileSync(
  join(root, 'migrations', 'raw', '0004_property_postgis.sql'),
  'utf8',
);

// Every new tenant-scoped table the core wave introduces. The model name maps
// to the snake_case table name via @@map.
const CORE_MODELS: ReadonlyArray<{ model: string; table: string }> = [
  { model: 'Branch', table: 'branches' },
  { model: 'Agent', table: 'agents' },
  { model: 'Property', table: 'properties' },
  { model: 'Enquiry', table: 'enquiries' },
  { model: 'Viewing', table: 'viewings' },
  { model: 'Valuation', table: 'valuations' },
  { model: 'RepairRequest', table: 'repair_requests' },
  { model: 'Contact', table: 'contacts' },
];

// Canonical enums (PRODUCT.md §2/§3) + their snake_case @@map name.
const CORE_ENUMS: ReadonlyArray<{ name: string; table: string; values: readonly string[] }> = [
  { name: 'ListingType', table: 'listing_type', values: ['residential', 'new_home', 'commercial'] },
  { name: 'SaleType', table: 'sale_type', values: ['sale', 'rent'] },
  {
    name: 'MarketStatus',
    table: 'market_status',
    values: [
      'for_sale',
      'under_offer',
      'sold_stc',
      'sold',
      'to_let',
      'let_agreed',
      'let',
      'withdrawn',
    ],
  },
  { name: 'LeadType', table: 'lead_type', values: ['buyer_enquiry'] },
  { name: 'EnquiryStatus', table: 'enquiry_status', values: ['new'] },
  { name: 'ViewingStatus', table: 'viewing_status', values: ['pending'] },
  { name: 'ValuationStatus', table: 'valuation_status', values: ['new'] },
  {
    name: 'RepairUrgency',
    table: 'repair_urgency',
    values: ['emergency', 'urgent', 'standard', 'low'],
  },
  { name: 'RepairStatus', table: 'repair_status', values: ['new'] },
];

function modelBlock(model: string): string {
  const re = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = schema.match(re);
  expect(match, `model ${model} should be declared`).not.toBeNull();
  return match![0];
}

describe('§J core entities — schema presence', () => {
  it.each(CORE_MODELS)('declares model $model mapped to $table', ({ model, table }) => {
    const block = modelBlock(model);
    expect(block).toContain(`@@map("${table}")`);
  });

  it.each(CORE_MODELS)('makes $model tenant-scoped (tenant_id uuid + index)', ({ model }) => {
    const block = modelBlock(model);
    expect(block).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(block).toContain('@@index([tenantId])');
    // every tenant-scoped table relates back to the platform tenant registry
    expect(block).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it.each(CORE_MODELS)('gives $model a non-enumerable uuid primary key', ({ model }) => {
    const block = modelBlock(model);
    expect(block).toMatch(/id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  });
});

describe('§J core entities — canonical naming (PRODUCT.md §3)', () => {
  it.each(CORE_ENUMS)('declares enum $name mapped to $table', ({ name, table }) => {
    expect(schema).toMatch(new RegExp(`enum ${name} \\{`));
    expect(schema).toContain(`@@map("${table}")`);
  });

  it.each(CORE_ENUMS)('enum $name carries its canonical values', ({ name, values }) => {
    const re = new RegExp(`enum ${name} \\{[\\s\\S]*?\\n\\}`, 'm');
    const block = schema.match(re);
    expect(block).not.toBeNull();
    for (const value of values) {
      expect(block![0]).toMatch(new RegExp(`\\b${value}\\b`));
    }
  });

  it('never names the catalogue entity Listing/House (uses Property)', () => {
    expect(schema).not.toMatch(/\bmodel (Listing|House)\b/);
    expect(schema).toMatch(/\bmodel Property\b/);
  });

  it('never names the lead entity Lead/Inquiry (uses Enquiry)', () => {
    expect(schema).not.toMatch(/\bmodel (Lead|Inquiry)\b/);
    expect(schema).toMatch(/\bmodel Enquiry\b/);
  });

  it('MarketStatus matches the --colour-status-* token set (no extras)', () => {
    const block = schema.match(/enum MarketStatus \{[\s\S]*?\n\}/m)![0];
    // sold_stc / let_agreed are the dashed-token names in snake_case
    expect(block).toMatch(/\bsold_stc\b/);
    expect(block).toMatch(/\blet_agreed\b/);
  });
});

describe('§J relationships (master spec §J.9)', () => {
  it('Property belongs to a branch (branchId FK)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/branchId\s+String\??\s+@map\("branch_id"\)\s+@db\.Uuid/);
  });

  it('Enquiry may reference a property (nullable propertyId FK)', () => {
    const block = modelBlock('Enquiry');
    expect(block).toMatch(/propertyId\s+String\?\s+@map\("property_id"\)\s+@db\.Uuid/);
  });

  it('Viewing belongs to a property (propertyId FK)', () => {
    const block = modelBlock('Viewing');
    expect(block).toMatch(/propertyId\s+String\s+@map\("property_id"\)\s+@db\.Uuid/);
  });

  it('Agent belongs to a branch (branchId FK)', () => {
    const block = modelBlock('Agent');
    expect(block).toMatch(/branchId\s+String\??\s+@map\("branch_id"\)\s+@db\.Uuid/);
  });
});

describe('§J Property catalogue attributes (master spec §F)', () => {
  it('carries the discriminator + status enums and spatial coordinates', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/listingType\s+ListingType/);
    expect(block).toMatch(/saleType\s+SaleType/);
    expect(block).toMatch(/marketStatus\s+MarketStatus/);
    expect(block).toMatch(/latitude\s+Float\?/);
    expect(block).toMatch(/longitude\s+Float\?/);
    expect(block).toMatch(/price\s+Int\?/); // pence
    expect(block).toMatch(/reference\s+String/);
    expect(block).toMatch(/publishedAt\s+DateTime\?\s+@map\("published_at"\)/);
  });
});

describe('§J RepairRequest urgency (canonical RepairUrgency values)', () => {
  it('models the four urgency levels', () => {
    const block = schema.match(/enum RepairUrgency \{[\s\S]*?\n\}/m)![0];
    for (const level of ['emergency', 'urgent', 'standard', 'low']) {
      expect(block).toMatch(new RegExp(`\\b${level}\\b`));
    }
  });
});

describe('0003 RLS migration — tenant isolation on every new table', () => {
  it.each(CORE_MODELS)('enables + forces RLS on $table', ({ table }) => {
    expect(rlsMigration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    expect(rlsMigration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
  });

  it.each(CORE_MODELS)('declares a tenant_isolation policy on $table', ({ table }) => {
    expect(rlsMigration).toContain(`CREATE POLICY tenant_isolation ON ${table}`);
  });

  it('uses the NULLIF fail-closed GUC pattern with USING + WITH CHECK', () => {
    const pattern = "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid";
    // one USING + one WITH CHECK occurrence per table
    const usingCount = rlsMigration.split('USING (tenant_id = ' + pattern).length - 1;
    const checkCount = rlsMigration.split('WITH CHECK (tenant_id = ' + pattern).length - 1;
    expect(usingCount).toBe(CORE_MODELS.length);
    expect(checkCount).toBe(CORE_MODELS.length);
  });
});

describe('0004 PostGIS migration — radius-search spatial column', () => {
  it('adds a geography(Point,4326) column to properties', () => {
    expect(postgisMigration).toMatch(/geography\(Point\s*,\s*4326\)/i);
    expect(postgisMigration).toMatch(/ALTER TABLE properties/i);
  });

  it('populates the geography from longitude/latitude (lon, lat order)', () => {
    // ST_MakePoint takes (longitude, latitude); SRID 4326 set via ST_SetSRID
    expect(postgisMigration).toMatch(/ST_SetSRID/i);
    expect(postgisMigration).toMatch(/ST_MakePoint\s*\(\s*longitude\s*,\s*latitude\s*\)/i);
  });

  it('creates a GiST index for radius queries', () => {
    expect(postgisMigration).toMatch(/USING\s+GIST/i);
  });

  it('documents that pglite/PostGIS is the CI (Testcontainers) path', () => {
    expect(postgisMigration.toLowerCase()).toMatch(/pglite|testcontainers/);
  });
});

describe('RLS tenant isolation on properties (pglite — mirrors 0003)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE properties (tenant_id uuid NOT NULL, reference text NOT NULL);
      ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON properties
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON properties TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO properties (tenant_id, reference) VALUES ('${TENANT_A}','AGY-S-1')`);
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    await db.exec(`INSERT INTO properties (tenant_id, reference) VALUES ('${TENANT_B}','AGY-S-2')`);

    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    const a = await db.query<{ reference: string }>(`SELECT reference FROM properties`);
    expect(a.rows.map((r) => r.reference)).toEqual(['AGY-S-1']);

    await db.exec(`RESET app.current_tenant_id`);
    const none = await db.query<{ reference: string }>(`SELECT reference FROM properties`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO properties (tenant_id, reference) VALUES ('${TENANT_B}','smuggled')`),
    ).rejects.toThrow();
    await db.close();
  });
});
