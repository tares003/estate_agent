import { describe, expect, it } from 'vitest';

import {
  PROPERTY_VERTICAL_FIELD_OWNERS,
  propertyCreateSchema,
  validatePropertyVerticalFields,
  type PropertyListingType,
} from './property-write.js';

// EPIC-F FR-F-3 — per-vertical extension attributes on the single Property entity,
// validated CONDITIONALLY on listing_type. This unit suite pins the field-ownership
// table (which extension field belongs to which vertical) and the isolation rule the
// acceptance criteria demand: "a residential listing does not require business
// turnover; a business-transfer listing does not require council tax band."

const CORE = {
  reference: 'REF-001',
  saleType: 'sale',
  displayAddress: '1 Trade Street, Manchester',
  postcode: 'M1 1AA',
} as const;

describe('PROPERTY_VERTICAL_FIELD_OWNERS (the ownership table)', () => {
  it('assigns every extension field to exactly one owning vertical', () => {
    const owners = new Set<PropertyListingType>();
    for (const owner of Object.values(PROPERTY_VERTICAL_FIELD_OWNERS)) {
      owners.add(owner);
    }
    expect([...owners].sort()).toEqual(
      ['business_transfer', 'care_home', 'commercial', 'new_home'].sort(),
    );
  });

  it('owns exactly the 16 vertical extension fields', () => {
    expect(Object.keys(PROPERTY_VERTICAL_FIELD_OWNERS).sort()).toEqual(
      [
        'isOffPlan',
        'developmentName',
        'vatPayable',
        'annualBusinessRates',
        'useClass',
        'annualTurnover',
        'grossProfit',
        'netProfit',
        'yearsTrading',
        'staffCount',
        'currentAnnualRent',
        'isConfidential',
        'bedCount',
        'cqcRating',
        'cqcInspectionUrl',
        'isGoingConcern',
      ].sort(),
    );
  });
});

describe('validatePropertyVerticalFields — every vertical accepts only its own fields', () => {
  const cases: Array<{
    listingType: PropertyListingType;
    own: Record<string, unknown>;
    foreign: Record<string, unknown>;
  }> = [
    {
      listingType: 'new_home',
      own: { isOffPlan: true, developmentName: 'The Waterside' },
      foreign: { annualTurnover: 1000 },
    },
    {
      listingType: 'commercial',
      own: { vatPayable: true, annualBusinessRates: 100, useClass: 'e' },
      foreign: { cqcRating: 'good' },
    },
    {
      listingType: 'business_transfer',
      own: {
        annualTurnover: 100,
        grossProfit: 50,
        netProfit: 25,
        yearsTrading: 5,
        staffCount: 3,
        currentAnnualRent: 20,
        isConfidential: true,
      },
      foreign: { bedCount: 10 },
    },
    {
      listingType: 'care_home',
      own: { bedCount: 40, cqcRating: 'good', cqcInspectionUrl: 'https://x.test', isGoingConcern: true },
      foreign: { useClass: 'e' },
    },
  ];

  for (const { listingType, own, foreign } of cases) {
    it(`accepts the ${listingType} own fields and rejects a foreign one`, () => {
      expect(validatePropertyVerticalFields(listingType, own)).toEqual([]);
      const issues = validatePropertyVerticalFields(listingType, foreign);
      expect(issues.length).toBeGreaterThan(0);
    });
  }

  it('rejects a residential listing carrying any extension field', () => {
    expect(validatePropertyVerticalFields('residential', { bedCount: 5 })).toHaveLength(1);
    expect(validatePropertyVerticalFields('land', { useClass: 'e' })).toHaveLength(1);
  });
});

describe('propertyCreateSchema accepts a full per-vertical payload', () => {
  it('parses a business_transfer with all its financials', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'business_transfer',
      annualTurnover: 500000,
      grossProfit: 200000,
      netProfit: 120000,
      yearsTrading: 15,
      staffCount: 10,
      currentAnnualRent: 30000,
      isConfidential: true,
    });
    expect(res.success).toBe(true);
  });
});
