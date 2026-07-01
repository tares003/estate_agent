import { describe, expect, it } from 'vitest';

import { IMPORT_COLUMNS, formatRowError, parsePropertyImportCsv } from './csv-import-core.js';

// EPIC-X FR-X-1 / FR-X-5 — the pure parse+validate core. DB-free: feed it a CSV string,
// assert the {valid, errors} partition. Covers good rows, bad rows, missing required
// columns, numeric coercion, ignored columns, and malformed / empty files.

const HEADER = 'reference,listingType,saleType,displayAddress,postcode,title,town,price,bedrooms';

/** A well-formed data row (all required fields present, valid enums). */
const GOOD_ROW =
  'REF-001,residential,sale,12 Acacia Avenue,M21 9WN,Charming Flat,Chorlton,350000,2';

describe('parsePropertyImportCsv', () => {
  it('partitions a file of good rows into valid with no errors', () => {
    const csv = `${HEADER}\n${GOOD_ROW}\n`;
    const result = parsePropertyImportCsv(csv);
    expect(result.parseError).toBeUndefined();
    expect(result.recordsInput).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]!.rowNumber).toBe(1);
    expect(result.valid[0]!.data).toMatchObject({
      reference: 'REF-001',
      listingType: 'residential',
      saleType: 'sale',
      displayAddress: '12 Acacia Avenue',
      postcode: 'M21 9WN',
      title: 'Charming Flat',
      town: 'Chorlton',
    });
  });

  it('coerces numeric columns (price, bedrooms) from CSV strings to numbers', () => {
    const result = parsePropertyImportCsv(`${HEADER}\n${GOOD_ROW}\n`);
    expect(result.valid[0]!.data.price).toBe(350000);
    expect(result.valid[0]!.data.bedrooms).toBe(2);
  });

  it('normalises the postcode to the canonical spaced upper-case form', () => {
    const row = 'REF-002,residential,sale,1 High St,m219wn,,,,';
    const result = parsePropertyImportCsv(`${HEADER}\n${row}\n`);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]!.data.postcode).toBe('M21 9WN');
  });

  it('isolates a row missing a required field (postcode) as an error, keeping others valid', () => {
    // Second row has an empty postcode -> required-field failure.
    const bad = 'REF-003,residential,sale,2 Low St,,No Postcode,Town,,';
    const result = parsePropertyImportCsv(`${HEADER}\n${GOOD_ROW}\n${bad}\n`);
    expect(result.recordsInput).toBe(2);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.rowNumber).toBe(2);
    expect(result.errors[0]!.errors.some((e) => e.field === 'postcode')).toBe(true);
  });

  it('flags an invalid enum value against its field', () => {
    const bad = 'REF-004,houseboat,sale,3 Sea Rd,M21 9WN,Bad Type,Town,,';
    const result = parsePropertyImportCsv(`${HEADER}\n${bad}\n`);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.errors.some((e) => e.field === 'listingType')).toBe(true);
  });

  it('flags a non-numeric price against the price field', () => {
    const bad = 'REF-005,residential,sale,4 Oak Rd,M21 9WN,Bad Price,Town,not-a-number,';
    const result = parsePropertyImportCsv(`${HEADER}\n${bad}\n`);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]!.errors.some((e) => e.field === 'price')).toBe(true);
  });

  it('reports a parse error and processes no rows when a required column is missing entirely', () => {
    // Header omits `reference` and `postcode` -> every row fails the required checks.
    const header = 'listingType,saleType,displayAddress';
    const row = 'residential,sale,5 Elm Rd';
    const result = parsePropertyImportCsv(`${header}\n${row}\n`);
    expect(result.recordsInput).toBe(1);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    const fields = result.errors[0]!.errors.map((e) => e.field);
    expect(fields).toContain('reference');
    expect(fields).toContain('postcode');
    expect(result.recognisedColumns).toEqual(['listingType', 'saleType', 'displayAddress']);
  });

  it('lists recognised and ignored columns', () => {
    const header = `reference,listingType,saleType,displayAddress,postcode,agent_notes`;
    const row = 'REF-006,residential,sale,6 Fir Rd,M21 9WN,ignore me';
    const result = parsePropertyImportCsv(`${header}\n${row}\n`);
    expect(result.ignoredColumns).toEqual(['agent_notes']);
    expect(result.recognisedColumns).not.toContain('agent_notes');
    // The ignored column does not block a valid row.
    expect(result.valid).toHaveLength(1);
  });

  it('returns a parse error for an empty file (no data rows)', () => {
    const result = parsePropertyImportCsv(`${HEADER}\n`);
    expect(result.parseError).toBeDefined();
    expect(result.valid).toHaveLength(0);
    expect(result.recordsInput).toBe(0);
  });

  it('returns a parse error for a wholly empty string', () => {
    const result = parsePropertyImportCsv('');
    expect(result.parseError).toBeDefined();
  });

  it('returns a parse error for structurally malformed CSV', () => {
    // An unterminated quoted field is a hard CSV parse failure.
    const csv = `${HEADER}\nREF-007,residential,sale,"unterminated,M21 9WN,T,Town,1,1\n`;
    const result = parsePropertyImportCsv(csv);
    expect(result.parseError).toBeDefined();
    expect(result.valid).toHaveLength(0);
  });

  it('numbers data rows from 1 (the header is not counted)', () => {
    const csv = `${HEADER}\n${GOOD_ROW}\n${GOOD_ROW.replace('REF-001', 'REF-008')}\n`;
    const result = parsePropertyImportCsv(csv);
    expect(result.valid.map((r) => r.rowNumber)).toEqual([1, 2]);
  });
});

describe('IMPORT_COLUMNS', () => {
  it('includes every required property-create field', () => {
    for (const required of ['reference', 'listingType', 'saleType', 'displayAddress', 'postcode']) {
      expect(IMPORT_COLUMNS).toContain(required);
    }
  });
});

describe('formatRowError', () => {
  it('renders the row number and each field reason on one line', () => {
    const line = formatRowError({
      rowNumber: 3,
      errors: [
        { field: 'postcode', message: 'Enter a valid UK postcode.' },
        { field: 'price', message: 'Expected number.' },
      ],
    });
    expect(line).toBe('Row 3 — postcode: Enter a valid UK postcode.; price: Expected number.');
  });

  it('renders a row-level (fieldless) error without a leading colon', () => {
    const line = formatRowError({ rowNumber: 1, errors: [{ field: '', message: 'Bad row.' }] });
    expect(line).toBe('Row 1 — Bad row.');
  });
});
