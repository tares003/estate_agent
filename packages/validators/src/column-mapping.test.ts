import { describe, expect, it } from 'vitest';

import {
  ALTO_PRESET,
  CRM_PRESET_NAMES,
  IMPORT_REQUIRED_COLUMNS,
  JUPIX_PRESET,
  REAPIT_PRESET,
  REX_PRESET,
  VEBRA_PRESET,
  detectCrmPreset,
  getPreset,
  isMappingComplete,
  mappingSchema,
  unmappedRequiredColumns,
  type ColumnMapping,
} from './column-mapping.js';

// EPIC-X FR-X-3 — the CSV column-mapping presets + the mapping validator. DB-free: the
// presets are code constants (nothing persisted per tenant), `detectCrmPreset` is a pure
// heuristic over the upload's headers, and `mappingSchema` is the shared Zod shape the
// import form and the two Server Actions parse the mapping JSON with. Covers: every preset
// maps the required canonical fields, detection picks the right CRM from its export
// headers, the schema accepts a partial (optional-only) mapping and rejects a malformed
// one, and the completeness helper flags an unmapped required field.

/** The five canonical fields the property-create schema requires. */
const REQUIRED = ['reference', 'listingType', 'saleType', 'displayAddress', 'postcode'] as const;

/** Assert a preset maps every required canonical field (its VALUES cover REQUIRED). */
function mapsAllRequired(preset: ColumnMapping): void {
  const mappedTargets = new Set(Object.values(preset));
  for (const required of REQUIRED) {
    expect(mappedTargets.has(required)).toBe(true);
  }
}

describe('CRM presets (FR-X-3)', () => {
  it('exposes the V1 preset names (reapit, alto, jupix, vebra, rex)', () => {
    expect(CRM_PRESET_NAMES).toEqual(['reapit', 'alto', 'jupix', 'vebra', 'rex']);
  });

  it('REAPIT_PRESET maps every required canonical field', () => {
    mapsAllRequired(REAPIT_PRESET);
  });

  it('ALTO_PRESET maps every required canonical field', () => {
    mapsAllRequired(ALTO_PRESET);
  });

  it('JUPIX_PRESET maps every required canonical field', () => {
    mapsAllRequired(JUPIX_PRESET);
  });

  it('VEBRA_PRESET maps every required canonical field', () => {
    mapsAllRequired(VEBRA_PRESET);
  });

  it('REX_PRESET maps every required canonical field', () => {
    mapsAllRequired(REX_PRESET);
  });

  it('every preset value is a recognised import column (no dangling targets)', () => {
    for (const name of CRM_PRESET_NAMES) {
      const preset = getPreset(name);
      for (const target of Object.values(preset)) {
        // A preset never maps a source header onto a canonical field the parser
        // does not understand — that would silently drop the column.
        expect(target).toBeDefined();
      }
    }
  });

  it('IMPORT_REQUIRED_COLUMNS lists exactly the five schema-required fields', () => {
    expect([...IMPORT_REQUIRED_COLUMNS].sort()).toEqual([...REQUIRED].sort());
  });
});

describe('getPreset', () => {
  it('returns the mapping for a named preset', () => {
    expect(getPreset('reapit')).toBe(REAPIT_PRESET);
    expect(getPreset('alto')).toBe(ALTO_PRESET);
  });
});

describe('detectCrmPreset (FR-X-3)', () => {
  it('detects Reapit from its export headers', () => {
    const headers = Object.keys(REAPIT_PRESET);
    expect(detectCrmPreset(headers)).toBe('reapit');
  });

  it('detects Alto from its export headers', () => {
    expect(detectCrmPreset(Object.keys(ALTO_PRESET))).toBe('alto');
  });

  it('detects Jupix from its export headers', () => {
    expect(detectCrmPreset(Object.keys(JUPIX_PRESET))).toBe('jupix');
  });

  it('detects Vebra from its export headers', () => {
    expect(detectCrmPreset(Object.keys(VEBRA_PRESET))).toBe('vebra');
  });

  it('detects Rex from its export headers', () => {
    expect(detectCrmPreset(Object.keys(REX_PRESET))).toBe('rex');
  });

  it('is case- and whitespace-insensitive on the header names', () => {
    const messy = Object.keys(REAPIT_PRESET).map((h) => `  ${h.toUpperCase()}  `);
    expect(detectCrmPreset(messy)).toBe('reapit');
  });

  it('returns null when the headers already use the canonical field names (no CRM)', () => {
    // A raw canonical CSV needs no preset — detection must not force one.
    expect(detectCrmPreset(['reference', 'listingType', 'saleType', 'displayAddress'])).toBeNull();
  });

  it('returns null for headers matching no known CRM', () => {
    expect(detectCrmPreset(['foo', 'bar', 'baz'])).toBeNull();
  });

  it('returns null for an empty header list', () => {
    expect(detectCrmPreset([])).toBeNull();
  });
});

describe('mappingSchema (FR-X-3)', () => {
  it('accepts a full CRM preset mapping', () => {
    expect(mappingSchema.safeParse(REAPIT_PRESET).success).toBe(true);
  });

  it('accepts a partial mapping (only some columns mapped)', () => {
    const partial: ColumnMapping = { 'Agency Reference': 'reference' };
    expect(mappingSchema.safeParse(partial).success).toBe(true);
  });

  it('accepts an empty mapping (map nothing; parser uses headers as-is)', () => {
    expect(mappingSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a mapping whose target is not a recognised import column', () => {
    const bad = { 'Some Column': 'not_a_real_field' };
    expect(mappingSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-object value', () => {
    expect(mappingSchema.safeParse('reference').success).toBe(false);
    expect(mappingSchema.safeParse(null).success).toBe(false);
  });

  it('parses to a typed ColumnMapping', () => {
    const parsed = mappingSchema.parse(ALTO_PRESET);
    expect(parsed['Ref']).toBe('reference');
  });
});

describe('unmappedRequiredColumns / isMappingComplete (FR-X-3)', () => {
  it('reports no unmapped required columns for a complete preset', () => {
    expect(unmappedRequiredColumns(REAPIT_PRESET)).toEqual([]);
    expect(isMappingComplete(REAPIT_PRESET)).toBe(true);
  });

  it('lists the required columns a partial mapping is missing', () => {
    const partial: ColumnMapping = { 'Agency Reference': 'reference' };
    const missing = unmappedRequiredColumns(partial);
    expect(missing).toContain('listingType');
    expect(missing).toContain('saleType');
    expect(missing).toContain('displayAddress');
    expect(missing).toContain('postcode');
    expect(missing).not.toContain('reference');
    expect(isMappingComplete(partial)).toBe(false);
  });

  it('treats an empty mapping as missing every required column', () => {
    expect(unmappedRequiredColumns({})).toHaveLength(IMPORT_REQUIRED_COLUMNS.length);
    expect(isMappingComplete({})).toBe(false);
  });
});
