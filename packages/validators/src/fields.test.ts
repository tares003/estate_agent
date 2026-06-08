import { describe, expect, it } from 'vitest';
import { email, gdprConsent, nonEmptyString, ukPhone, ukPostcode } from './fields.js';

describe('nonEmptyString', () => {
  it('accepts a non-empty string', () => {
    expect(nonEmptyString.safeParse('Albert Aardvark').success).toBe(true);
  });

  it('trims surrounding whitespace before storing', () => {
    const result = nonEmptyString.safeParse('  Albert Aardvark  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Albert Aardvark');
  });

  it('rejects an empty string', () => {
    expect(nonEmptyString.safeParse('').success).toBe(false);
  });

  it('rejects a whitespace-only string (collapses to empty after trim)', () => {
    expect(nonEmptyString.safeParse('   ').success).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(nonEmptyString.safeParse(42).success).toBe(false);
  });
});

describe('email', () => {
  it('accepts a well-formed address', () => {
    expect(email.safeParse('aardvark@example.invalid').success).toBe(true);
  });

  it('lowercases and trims the address', () => {
    const result = email.safeParse('  Aardvark@Example.Invalid  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('aardvark@example.invalid');
  });

  it('rejects a malformed address', () => {
    expect(email.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(email.safeParse('').success).toBe(false);
  });
});

describe('ukPhone', () => {
  it('accepts a plain UK mobile number', () => {
    expect(ukPhone.safeParse('07911123456').success).toBe(true);
  });

  it('accepts an +44 international form with spaces', () => {
    expect(ukPhone.safeParse('+44 7911 123456').success).toBe(true);
  });

  it('accepts a landline with a leading zero', () => {
    expect(ukPhone.safeParse('020 7946 0958').success).toBe(true);
  });

  it('rejects a number with too few digits', () => {
    expect(ukPhone.safeParse('12345').success).toBe(false);
  });

  it('rejects a string containing letters', () => {
    expect(ukPhone.safeParse('07911 ABC456').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(ukPhone.safeParse('').success).toBe(false);
  });
});

describe('ukPostcode', () => {
  it('accepts a full postcode with a space', () => {
    expect(ukPostcode.safeParse('SW1A 1AA').success).toBe(true);
  });

  it('accepts a postcode without a space and normalises it', () => {
    const result = ukPostcode.safeParse('sw1a1aa');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('SW1A 1AA');
  });

  it('accepts a short outward-code postcode', () => {
    expect(ukPostcode.safeParse('M1 1AE').success).toBe(true);
  });

  it('rejects a clearly invalid postcode', () => {
    expect(ukPostcode.safeParse('NOT A POSTCODE').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(ukPostcode.safeParse('').success).toBe(false);
  });
});

describe('gdprConsent', () => {
  it('accepts the literal boolean true', () => {
    expect(gdprConsent.safeParse(true).success).toBe(true);
  });

  it('rejects false', () => {
    expect(gdprConsent.safeParse(false).success).toBe(false);
  });

  it('rejects a missing value (undefined)', () => {
    expect(gdprConsent.safeParse(undefined).success).toBe(false);
  });

  it('rejects a truthy non-boolean', () => {
    expect(gdprConsent.safeParse('true').success).toBe(false);
  });
});
