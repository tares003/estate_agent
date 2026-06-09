import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// §J / EPIC-J (+ EPIC-F media/documents) — satellite entity schema verification.
//
// The satellite entities hang off the core catalogue: PropertyImage and
// PropertyDocument carry a property's media + paperwork (EPIC-F §F.1), Note is
// the polymorphic CRM/internal annotation (master spec §J.5), and
// PropertyStatusEvent is the append-only audit of market_status changes
// (master spec §J.3/§F lifecycle). Every one is TENANT-SCOPED.
//
// Like src/core-entities.test.ts this unit is schema-only (no src consumers land
// here), so the tests assert against the Prisma schema source text and the raw
// SQL migration rather than a generated client, and additionally exercise the
// new tenant_isolation RLS policy against pglite (in-process Postgres).

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0005_satellite_rls.sql'),
  'utf8',
);

// Every satellite tenant-scoped table this wave introduces; the model name maps
// to the snake_case table name via @@map.
const SATELLITE_MODELS: ReadonlyArray<{ model: string; table: string }> = [
  { model: 'PropertyImage', table: 'property_images' },
  { model: 'PropertyDocument', table: 'property_documents' },
  { model: 'Note', table: 'notes' },
  { model: 'PropertyStatusEvent', table: 'property_status_events' },
];

function modelBlock(model: string): string {
  const re = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = schema.match(re);
  expect(match, `model ${model} should be declared`).not.toBeNull();
  return match![0];
}

describe('§J satellite entities — schema presence', () => {
  it.each(SATELLITE_MODELS)('declares model $model mapped to $table', ({ model, table }) => {
    const block = modelBlock(model);
    expect(block).toContain(`@@map("${table}")`);
  });

  it.each(SATELLITE_MODELS)('makes $model tenant-scoped (tenant_id uuid + index)', ({ model }) => {
    const block = modelBlock(model);
    expect(block).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(block).toContain('@@index([tenantId])');
    // every tenant-scoped table relates back to the platform tenant registry
    expect(block).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it.each(SATELLITE_MODELS)('gives $model a non-enumerable uuid primary key', ({ model }) => {
    const block = modelBlock(model);
    expect(block).toMatch(/id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  });

  it.each(SATELLITE_MODELS)('stamps $model with a created_at timestamp', ({ model }) => {
    const block = modelBlock(model);
    expect(block).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
  });
});

describe('§J satellite — DocumentType enum (EPIC-F §F.1 paperwork)', () => {
  it('declares enum DocumentType mapped to document_type', () => {
    expect(schema).toMatch(/enum DocumentType \{/);
    expect(schema).toContain('@@map("document_type")');
  });

  it('carries the epc / floorplan / brochure / other values', () => {
    const block = schema.match(/enum DocumentType \{[\s\S]*?\n\}/m);
    expect(block).not.toBeNull();
    for (const value of ['epc', 'floorplan', 'brochure', 'other']) {
      expect(block![0]).toMatch(new RegExp(`\\b${value}\\b`));
    }
  });
});

describe('§J satellite — PropertyImage media attributes (EPIC-F §F.1)', () => {
  it('carries url, alt, ordering, primary flag and optional dimensions', () => {
    const block = modelBlock('PropertyImage');
    expect(block).toMatch(/url\s+String/);
    expect(block).toMatch(/alt\s+String/);
    expect(block).toMatch(/sortOrder\s+Int\s+@default\(0\)\s+@map\("sort_order"\)/);
    expect(block).toMatch(/isPrimary\s+Boolean\s+@default\(false\)\s+@map\("is_primary"\)/);
    // dimensions are optional (populated by the post-process job FR-F-7)
    expect(block).toMatch(/width\s+Int\?/);
    expect(block).toMatch(/height\s+Int\?/);
  });
});

describe('§J satellite — PropertyDocument attributes (EPIC-F §F.1)', () => {
  it('carries a typed document with a title and url', () => {
    const block = modelBlock('PropertyDocument');
    expect(block).toMatch(/type\s+DocumentType/);
    expect(block).toMatch(/title\s+String/);
    expect(block).toMatch(/url\s+String/);
  });
});

describe('§J satellite — Note polymorphic annotation (master spec §J.5)', () => {
  it('uses an entityType + entityId polymorphic shape with a body', () => {
    const block = modelBlock('Note');
    expect(block).toMatch(/entityType\s+String\s+@map\("entity_type"\)/);
    expect(block).toMatch(/entityId\s+String\s+@map\("entity_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/body\s+String/);
    // the authoring agent is optional (system-generated notes carry none)
    expect(block).toMatch(/authorAgentId\s+String\?\s+@map\("author_agent_id"\)\s+@db\.Uuid/);
  });

  it('carries an is-internal flag (FR-I-5) defaulting to internal', () => {
    // A note is private to staff unless explicitly marked client-visible; the
    // flag controls whether it surfaces in client-facing communications.
    const block = modelBlock('Note');
    expect(block).toMatch(/isInternal\s+Boolean\s+@default\(true\)\s+@map\("is_internal"\)/);
  });

  it('indexes the polymorphic target so an entity timeline is cheap to fetch', () => {
    const block = modelBlock('Note');
    expect(block).toContain('@@index([tenantId, entityType, entityId])');
  });
});

describe('§J satellite — PropertyStatusEvent audit (master spec §J.3)', () => {
  it('belongs to a property (propertyId FK)', () => {
    const block = modelBlock('PropertyStatusEvent');
    expect(block).toMatch(/propertyId\s+String\s+@map\("property_id"\)\s+@db\.Uuid/);
  });

  it('reuses the MarketStatus enum: optional from + required to', () => {
    const block = modelBlock('PropertyStatusEvent');
    // first transition has no prior status, so fromStatus is nullable
    expect(block).toMatch(/fromStatus\s+MarketStatus\?\s+@map\("from_status"\)/);
    expect(block).toMatch(/toStatus\s+MarketStatus\s+@map\("to_status"\)/);
  });

  it('records when and (optionally) by which agent the change happened', () => {
    const block = modelBlock('PropertyStatusEvent');
    expect(block).toMatch(/changedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("changed_at"\)/);
    expect(block).toMatch(
      /changedByAgentId\s+String\?\s+@map\("changed_by_agent_id"\)\s+@db\.Uuid/,
    );
  });
});

describe('§J satellite relationships (master spec §J.9)', () => {
  it.each([
    { model: 'PropertyImage' },
    { model: 'PropertyDocument' },
    { model: 'PropertyStatusEvent' },
  ])('$model belongs to a property (propertyId FK + relation)', ({ model }) => {
    const block = modelBlock(model);
    expect(block).toMatch(/propertyId\s+String\s+@map\("property_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/property\s+Property\s+@relation/);
  });

  it('Property declares back-relations to its satellites', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/images\s+PropertyImage\[\]/);
    expect(block).toMatch(/documents\s+PropertyDocument\[\]/);
    expect(block).toMatch(/statusEvents\s+PropertyStatusEvent\[\]/);
  });
});

describe('0005 RLS migration — tenant isolation on every satellite table', () => {
  it.each(SATELLITE_MODELS)('enables + forces RLS on $table', ({ table }) => {
    expect(rlsMigration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    expect(rlsMigration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
  });

  it.each(SATELLITE_MODELS)('declares a tenant_isolation policy on $table', ({ table }) => {
    expect(rlsMigration).toContain(`CREATE POLICY tenant_isolation ON ${table}`);
  });

  it('uses the NULLIF fail-closed GUC pattern with USING + WITH CHECK on every table', () => {
    const pattern = "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid";
    const usingCount = rlsMigration.split('USING (tenant_id = ' + pattern).length - 1;
    const checkCount = rlsMigration.split('WITH CHECK (tenant_id = ' + pattern).length - 1;
    expect(usingCount).toBe(SATELLITE_MODELS.length);
    expect(checkCount).toBe(SATELLITE_MODELS.length);
  });
});

describe('RLS tenant isolation on property_images (pglite — mirrors 0005)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE property_images (tenant_id uuid NOT NULL, url text NOT NULL);
      ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON property_images
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON property_images TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO property_images (tenant_id, url) VALUES ('${TENANT_A}','a.jpg')`);
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    await db.exec(`INSERT INTO property_images (tenant_id, url) VALUES ('${TENANT_B}','b.jpg')`);

    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    const a = await db.query<{ url: string }>(`SELECT url FROM property_images`);
    expect(a.rows.map((r) => r.url)).toEqual(['a.jpg']);

    await db.exec(`RESET app.current_tenant_id`);
    const none = await db.query<{ url: string }>(`SELECT url FROM property_images`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO property_images (tenant_id, url) VALUES ('${TENANT_B}','smuggled.jpg')`),
    ).rejects.toThrow();
    await db.close();
  });
});
