import { describe, expect, it } from 'vitest';

import {
  buildMatchIndex,
  importMatchField,
  planImportRows,
  IMPORT_MODES,
  type ExistingPropertyKey,
  type ValidRow,
} from './csv-import-core.js';

// EPIC-X FR-X-2 / FR-X-4 — the PURE upsert planning core. DB-free: given the validated
// rows, the chosen import mode's match field and an index of the tenant's existing
// property identities (match value → property id), the planner decides per row whether
// the run would CREATE a new listing, UPDATE the matched one, or SKIP the row (upsert on
// external id, row carries none). Shared by the dry-run preview (what WOULD happen) and
// the audited import (what DOES happen), so the two can never disagree.

/** A minimal valid row for planning (only identity fields matter to the planner). */
function row(
  rowNumber: number,
  reference: string,
  externalId?: string,
  publicationStatus?: 'draft' | 'published',
): ValidRow {
  return {
    rowNumber,
    data: {
      reference,
      listingType: 'residential',
      saleType: 'sale',
      displayAddress: `${rowNumber} Acacia Ave`,
      postcode: 'M21 9WN',
      ...(externalId !== undefined ? { externalId } : {}),
      ...(publicationStatus !== undefined ? { publicationStatus } : {}),
    },
  };
}

/** An existing property's identity as read from the tenant's catalogue. */
function existing(id: string, reference: string, externalId: string | null): ExistingPropertyKey {
  return { id, reference, externalId };
}

describe('IMPORT_MODES / importMatchField (FR-X-2 / FR-X-4)', () => {
  it('offers exactly the brief-defined modes: create only, upsert on reference, upsert on external id', () => {
    expect(IMPORT_MODES).toEqual(['create_only', 'upsert_reference', 'upsert_external_id']);
  });

  it('resolves the match field per mode (null for create-only)', () => {
    expect(importMatchField('create_only')).toBeNull();
    expect(importMatchField('upsert_reference')).toBe('reference');
    expect(importMatchField('upsert_external_id')).toBe('externalId');
  });
});

describe('buildMatchIndex (FR-X-4)', () => {
  it('indexes existing properties by reference', () => {
    const index = buildMatchIndex(
      [existing('p-1', 'REF-001', null), existing('p-2', 'REF-002', 'EXT-2')],
      'reference',
    );
    expect(index.get('REF-001')).toBe('p-1');
    expect(index.get('REF-002')).toBe('p-2');
  });

  it('indexes existing properties by external id, skipping rows without one', () => {
    const index = buildMatchIndex(
      [existing('p-1', 'REF-001', null), existing('p-2', 'REF-002', 'EXT-2')],
      'externalId',
    );
    expect(index.has('REF-001')).toBe(false);
    expect(index.size).toBe(1);
    expect(index.get('EXT-2')).toBe('p-2');
  });

  it('keeps the FIRST occurrence when two existing rows share an external id (deterministic)', () => {
    const index = buildMatchIndex(
      [existing('p-1', 'REF-001', 'EXT-DUP'), existing('p-2', 'REF-002', 'EXT-DUP')],
      'externalId',
    );
    expect(index.get('EXT-DUP')).toBe('p-1');
  });

  it('never indexes an empty-string key', () => {
    const index = buildMatchIndex([existing('p-1', 'REF-001', '')], 'externalId');
    expect(index.size).toBe(0);
  });
});

describe('planImportRows (FR-X-2 / FR-X-4 / FR-X-5)', () => {
  it('plans every row as a create when no match field applies (create-only mode)', () => {
    const plan = planImportRows([row(1, 'REF-001'), row(2, 'REF-002')], null, new Map());
    expect(plan).toHaveLength(2);
    expect(plan.every((planned) => planned.action === 'create')).toBe(true);
  });

  it('plans an UPDATE for a row whose reference matches an existing listing', () => {
    const index = buildMatchIndex([existing('p-1', 'REF-001', null)], 'reference');
    const plan = planImportRows([row(1, 'REF-001'), row(2, 'REF-NEW')], 'reference', index);
    expect(plan[0]).toMatchObject({ action: 'update', propertyId: 'p-1', matchedOn: 'reference' });
    expect(plan[1]).toMatchObject({ action: 'create' });
  });

  it('plans an UPDATE for a row whose external id matches, regardless of its reference', () => {
    const index = buildMatchIndex([existing('p-9', 'OLD-REF', 'EXT-1')], 'externalId');
    const plan = planImportRows([row(1, 'REF-001', 'EXT-1')], 'externalId', index);
    expect(plan[0]).toMatchObject({ action: 'update', propertyId: 'p-9', matchedOn: 'externalId' });
  });

  it('SKIPS a row without an external id value in external-id mode (never blind-creates)', () => {
    // Creating an unmatchable row would mint a duplicate on every re-run, violating the
    // acceptance criterion — the planner skips it with a reason instead.
    const plan = planImportRows(
      [row(1, 'REF-001'), row(2, 'REF-002', 'EXT-2')],
      'externalId',
      new Map(),
    );
    expect(plan[0]).toMatchObject({ action: 'skip' });
    expect(plan[0]!.action === 'skip' && plan[0]!.reason).toMatch(/external/i);
    expect(plan[1]).toMatchObject({ action: 'create' });
  });

  it('keeps the plan in source-row order', () => {
    const index = buildMatchIndex([existing('p-1', 'REF-002', null)], 'reference');
    const plan = planImportRows([row(1, 'REF-001'), row(2, 'REF-002')], 'reference', index);
    expect(plan.map((planned) => planned.row.rowNumber)).toEqual([1, 2]);
  });

  it('re-planning the same file against the post-import catalogue yields zero creates (idempotence)', () => {
    // The acceptance criterion in planner terms: once every row exists, the same file
    // plans as all-updates — nothing would be created twice.
    const rows = [row(1, 'REF-001'), row(2, 'REF-002')];
    const index = buildMatchIndex(
      [existing('p-1', 'REF-001', null), existing('p-2', 'REF-002', null)],
      'reference',
    );
    const plan = planImportRows(rows, 'reference', index);
    expect(plan.filter((planned) => planned.action === 'create')).toHaveLength(0);
    expect(plan.filter((planned) => planned.action === 'update')).toHaveLength(2);
  });
});
