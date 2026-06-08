import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// D-012 — composite (tenant_id, <fk>) foreign keys enforce SAME-TENANT
// references at the database layer. Postgres validates a foreign key with RLS
// BYPASSED, so RLS alone does not stop a user-supplied id (e.g. the hidden
// property_id on the public enquiry form) from pointing a tenant-A child row at
// a tenant-B parent. Including tenant_id in the FK closes that hole.
//
// Mirrors the live-pglite approach of rls.test.ts / core-entities.test.ts:
// minimal versions of every table 0006 touches are created, the REAL
// migrations/raw/0006_composite_tenant_fks.sql is applied to them, and the
// cross-tenant / SET NULL / CASCADE behaviours are asserted. Because FK checks
// are independent of RLS, these run as pglite's default (superuser) role — which
// is exactly the condition under which RLS would NOT have protected the
// reference. The full apply against PostgreSQL runs via Testcontainers in CI.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const migration = readFileSync(
  join(root, 'migrations', 'raw', '0006_composite_tenant_fks.sql'),
  'utf8',
);

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const PROP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BRANCH_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// Minimal versions of every table 0006 touches — only the FK-relevant columns,
// matching the real schema's nullability (the migration's column-list SET NULL
// relies on tenant_id being NOT NULL and the fk column being nullable).
const MINIMAL_SCHEMA = `
  CREATE TABLE branches (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
  CREATE TABLE properties (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid);
  CREATE TABLE agents (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid);
  CREATE TABLE enquiries (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, property_id uuid);
  CREATE TABLE repair_requests (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, property_id uuid);
  CREATE TABLE viewings (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, property_id uuid NOT NULL);
  CREATE TABLE property_images (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, property_id uuid NOT NULL);
  CREATE TABLE property_documents (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, property_id uuid NOT NULL);
  CREATE TABLE property_status_events (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, property_id uuid NOT NULL);
`;

/** A pglite DB with the minimal schema, a tenant-A branch + property seeded, and 0006 applied. */
async function migratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(MINIMAL_SCHEMA);
  await db.exec(`INSERT INTO branches (id, tenant_id) VALUES ('${BRANCH_A}','${TENANT_A}')`);
  await db.exec(`INSERT INTO properties (id, tenant_id) VALUES ('${PROP_A}','${TENANT_A}')`);
  await db.exec(migration);
  return db;
}

let n = 0;
/** A fresh uuid for each inserted row (deterministic, no clock/random). */
function rowId(): string {
  n += 1;
  return `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}

// Postgres reports a composite-FK violation with this phrase; asserting it (not
// just "throws") rules out a syntax error or unrelated constraint masquerading
// as the cross-tenant block.
const FK_VIOLATION = /violates foreign key constraint/i;

// Every hardened child relation with a same-tenant (tenant A) parent it may
// legitimately reference — drives the exhaustive cross-tenant rejection sweep.
const CHILDREN: ReadonlyArray<{ table: string; fk: string; parentRef: string }> = [
  { table: 'agents', fk: 'branch_id', parentRef: BRANCH_A },
  { table: 'properties', fk: 'branch_id', parentRef: BRANCH_A },
  { table: 'enquiries', fk: 'property_id', parentRef: PROP_A },
  { table: 'repair_requests', fk: 'property_id', parentRef: PROP_A },
  { table: 'viewings', fk: 'property_id', parentRef: PROP_A },
  { table: 'property_images', fk: 'property_id', parentRef: PROP_A },
  { table: 'property_documents', fk: 'property_id', parentRef: PROP_A },
  { table: 'property_status_events', fk: 'property_id', parentRef: PROP_A },
];

describe('composite tenant FKs — behaviour (pglite applies 0006_composite_tenant_fks.sql)', () => {
  it('demonstrates the D-012 hole: a single-column FK admits a cross-tenant reference', async () => {
    // The OLD shape — a single-column FK to properties(id) — checks only that
    // the id exists, NOT that it belongs to the same tenant, so a tenant-B row
    // can point at a tenant-A property. This is the gap the migration closes;
    // the migrated cases below reject exactly this insert.
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE properties (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
      CREATE TABLE enquiries (
        id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
        property_id uuid REFERENCES properties (id)
      );
    `);
    await db.exec(`INSERT INTO properties (id, tenant_id) VALUES ('${PROP_A}','${TENANT_A}')`);
    await db.exec(
      `INSERT INTO enquiries (id, tenant_id, property_id) VALUES ('${rowId()}','${TENANT_B}','${PROP_A}')`,
    );
    const rows = await db.query(`SELECT id FROM enquiries`);
    expect(rows.rows).toHaveLength(1); // wrongly accepted by the single-column FK
    await db.close();
  });

  // The exhaustive sweep: every one of the 8 hardened relations accepts a
  // same-tenant reference and rejects a cross-tenant one with an FK violation —
  // even as superuser (RLS bypassed), precisely the gap D-012 names.
  describe.each(CHILDREN)('composite FK on $table ($fk)', ({ table, fk, parentRef }) => {
    it('accepts a same-tenant reference and rejects a cross-tenant one', async () => {
      const db = await migratedDb();
      await db.exec(
        `INSERT INTO ${table} (id, tenant_id, ${fk}) VALUES ('${rowId()}','${TENANT_A}','${parentRef}')`,
      );
      await expect(
        db.exec(
          `INSERT INTO ${table} (id, tenant_id, ${fk}) VALUES ('${rowId()}','${TENANT_B}','${parentRef}')`,
        ),
      ).rejects.toThrow(FK_VIOLATION);
      await db.close();
    });
  });

  it('rejects an UPDATE that re-points an enquiry at another tenant’s property', async () => {
    const db = await migratedDb();
    const propB = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    await db.exec(`INSERT INTO properties (id, tenant_id) VALUES ('${propB}','${TENANT_B}')`);
    const id = rowId();
    await db.exec(
      `INSERT INTO enquiries (id, tenant_id, property_id) VALUES ('${id}','${TENANT_A}','${PROP_A}')`,
    );
    // The realistic attack: re-point a tenant-A enquiry at tenant-B's property.
    await expect(
      db.exec(`UPDATE enquiries SET property_id = '${propB}' WHERE id = '${id}'`),
    ).rejects.toThrow(FK_VIOLATION);
    await db.close();
  });

  it('still allows a general enquiry with no property (NULL fk, MATCH SIMPLE)', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO enquiries (id, tenant_id, property_id) VALUES ('${rowId()}','${TENANT_A}', NULL)`,
    );
    const rows = await db.query<{ property_id: string | null }>(
      `SELECT property_id FROM enquiries`,
    );
    expect(rows.rows).toEqual([{ property_id: null }]);
    await db.close();
  });

  it('nulls only property_id and preserves tenant_id when the property is deleted (SET NULL column-list)', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO enquiries (id, tenant_id, property_id) VALUES ('${rowId()}','${TENANT_A}','${PROP_A}')`,
    );
    await db.exec(`DELETE FROM properties WHERE id = '${PROP_A}'`);
    const rows = await db.query<{ tenant_id: string; property_id: string | null }>(
      `SELECT tenant_id, property_id FROM enquiries`,
    );
    expect(rows.rows).toEqual([{ tenant_id: TENANT_A, property_id: null }]);
    await db.close();
  });

  it('nulls only branch_id and preserves tenant_id when the branch is deleted (second parent)', async () => {
    // Exercises the column-list SET NULL form against the OTHER parent (branches),
    // proving it is not an enquiries-only special case.
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO agents (id, tenant_id, branch_id) VALUES ('${rowId()}','${TENANT_A}','${BRANCH_A}')`,
    );
    await db.exec(`DELETE FROM branches WHERE id = '${BRANCH_A}'`);
    const rows = await db.query<{ tenant_id: string; branch_id: string | null }>(
      `SELECT tenant_id, branch_id FROM agents`,
    );
    expect(rows.rows).toEqual([{ tenant_id: TENANT_A, branch_id: null }]);
    await db.close();
  });

  it('cascade-deletes a viewing when its property is deleted', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO viewings (id, tenant_id, property_id) VALUES ('${rowId()}','${TENANT_A}','${PROP_A}')`,
    );
    await db.exec(`DELETE FROM properties WHERE id = '${PROP_A}'`);
    const rows = await db.query(`SELECT id FROM viewings`);
    expect(rows.rows).toEqual([]);
    await db.close();
  });
});

// Every tenant-scoped child→parent relation the schema declares where BOTH sides
// carry tenant_id, with the ON DELETE action carried over from the Prisma schema.
const COMPOSITE_FKS: ReadonlyArray<{
  child: string;
  fk: string;
  parent: string;
  onDelete: string;
}> = [
  { child: 'agents', fk: 'branch_id', parent: 'branches', onDelete: 'SET NULL (branch_id)' },
  { child: 'properties', fk: 'branch_id', parent: 'branches', onDelete: 'SET NULL (branch_id)' },
  {
    child: 'enquiries',
    fk: 'property_id',
    parent: 'properties',
    onDelete: 'SET NULL (property_id)',
  },
  {
    child: 'repair_requests',
    fk: 'property_id',
    parent: 'properties',
    onDelete: 'SET NULL (property_id)',
  },
  { child: 'viewings', fk: 'property_id', parent: 'properties', onDelete: 'CASCADE' },
  { child: 'property_images', fk: 'property_id', parent: 'properties', onDelete: 'CASCADE' },
  { child: 'property_documents', fk: 'property_id', parent: 'properties', onDelete: 'CASCADE' },
  { child: 'property_status_events', fk: 'property_id', parent: 'properties', onDelete: 'CASCADE' },
];

describe('0006 migration content (guards the real migration file)', () => {
  it('creates a UNIQUE (tenant_id, id) target on each referenced parent', () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX[^;]*\bbranches\b[^;]*\(tenant_id, id\)/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX[^;]*\bproperties\b[^;]*\(tenant_id, id\)/i);
  });

  it.each(COMPOSITE_FKS)(
    '$child carries a composite (tenant_id, $fk) FK to $parent ON DELETE $onDelete',
    ({ child, fk, parent, onDelete }) => {
      const fkRe = new RegExp(
        `ALTER TABLE ${child}[\\s\\S]*?FOREIGN KEY \\(tenant_id, ${fk}\\)\\s*REFERENCES ${parent} \\(tenant_id, id\\)`,
        'i',
      );
      expect(migration).toMatch(fkRe);

      const escaped = onDelete.replace(/[()]/g, (m) => `\\${m}`);
      expect(migration).toMatch(new RegExp(`${child}[\\s\\S]*?ON DELETE ${escaped}`, 'i'));
    },
  );

  it('re-points (drops the single-column FK on) every hardened child', () => {
    for (const { child, fk } of COMPOSITE_FKS) {
      expect(migration).toMatch(new RegExp(`DROP CONSTRAINT IF EXISTS ${child}_${fk}_fkey`, 'i'));
    }
  });
});
