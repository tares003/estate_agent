import { describe, expect, it } from 'vitest';

import type { CandidateProperty } from './saved-search-match.js';
import { alertAddressLine, alertTitle, isAlertAddressRedacted } from './alert-redaction.js';

// §F.5 confidential / §J hideExactAddress — the alert-email twin of the PUBLIC
// redaction rule (apps/web app/(app)/lib/properties.ts publicTitle /
// publicAddressLine / redactedAddressLine). An alert email is a public surface:
// whatever the catalogue redacts, the email must redact identically. These tests
// pin the twin to the same semantics so drift is caught here.

function property(over: Partial<CandidateProperty> = {}): CandidateProperty {
  return {
    id: 'p1',
    slug: 'a-flat',
    displayAddress: '1 High Street',
    postcode: 'M20 2AB',
    title: 'A lovely flat',
    saleType: 'sale',
    listingType: 'residential',
    marketStatus: 'for_sale',
    price: 25_000_000,
    bedrooms: 2,
    bathrooms: 1,
    town: 'Didsbury',
    publishedAt: new Date('2026-06-28T07:00:00Z'),
    deletedAt: null,
    ...over,
  };
}

describe('isAlertAddressRedacted', () => {
  it('redacts when either flag is set, fails open to exact only when both absent/false', () => {
    expect(isAlertAddressRedacted(property())).toBe(false);
    expect(isAlertAddressRedacted(property({ isConfidential: true }))).toBe(true);
    expect(isAlertAddressRedacted(property({ hideExactAddress: true }))).toBe(true);
    expect(
      isAlertAddressRedacted(property({ isConfidential: false, hideExactAddress: false })),
    ).toBe(false);
  });
});

describe('alertTitle', () => {
  it('hides even an explicit title for a confidential listing (it may name the business)', () => {
    expect(alertTitle(property({ isConfidential: true, title: 'Didsbury Bakery Ltd' }))).toBe(
      'Didsbury, M20',
    );
  });

  it('keeps the explicit title for a hideExactAddress listing', () => {
    expect(alertTitle(property({ hideExactAddress: true }))).toBe('A lovely flat');
  });

  it('falls back to the redacted line (not the display address) when untitled + redacted', () => {
    expect(alertTitle(property({ hideExactAddress: true, title: null }))).toBe('Didsbury, M20');
  });

  it('falls back to the display address when untitled and unredacted', () => {
    expect(alertTitle(property({ title: null }))).toBe('1 High Street');
  });
});

describe('alertAddressLine', () => {
  it('renders the exact "displayAddress, postcode" line when unredacted', () => {
    expect(alertAddressLine(property())).toBe('1 High Street, M20 2AB');
  });

  it('renders "town, prefix" when redacted', () => {
    expect(alertAddressLine(property({ isConfidential: true }))).toBe('Didsbury, M20');
  });

  it('prefers the stored postcodePrefix and tolerates a missing town', () => {
    expect(
      alertAddressLine(property({ hideExactAddress: true, postcodePrefix: 'M21', town: null })),
    ).toBe('M21');
    expect(alertAddressLine(property({ hideExactAddress: true, town: null }))).toBe('M20');
  });
});
