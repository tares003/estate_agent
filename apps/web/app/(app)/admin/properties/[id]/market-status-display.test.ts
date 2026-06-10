import { describe, expect, it } from 'vitest';

import { marketStatusLabel, marketStatusesForSaleType } from './market-status-display.js';

describe('marketStatusLabel', () => {
  it('humanises the status (with correct casing for Sold STC)', () => {
    expect(marketStatusLabel('for_sale')).toBe('For sale');
    expect(marketStatusLabel('sold_stc')).toBe('Sold STC');
    expect(marketStatusLabel('let_agreed')).toBe('Let agreed');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(marketStatusLabel('mystery')).toBe('mystery');
  });
});

describe('marketStatusesForSaleType', () => {
  it('offers the sale statuses for a sale listing (not "Let")', () => {
    expect(marketStatusesForSaleType('sale')).toEqual([
      'for_sale',
      'under_offer',
      'sold_stc',
      'sold',
      'withdrawn',
    ]);
  });

  it('offers the rent statuses for a rental (not "Sold")', () => {
    expect(marketStatusesForSaleType('rent')).toEqual(['to_let', 'let_agreed', 'let', 'withdrawn']);
  });
});
