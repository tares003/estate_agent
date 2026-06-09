import { describe, expect, it } from 'vitest';
import { formatPrice, priceQualifier, rentFrequency, toCardStatus } from './format.js';

describe('formatPrice', () => {
  it('formats pence as GBP with thousands separators', () => {
    expect(formatPrice(52_500_000)).toBe('£525,000');
    expect(formatPrice(145_000)).toBe('£1,450');
  });
  it('returns POA for a null/undefined price', () => {
    expect(formatPrice(null)).toBe('POA');
    expect(formatPrice(undefined)).toBe('POA');
  });
});

describe('toCardStatus', () => {
  it('maps to_let to the to_rent display variant', () => {
    expect(toCardStatus('to_let')).toBe('to_rent');
  });
  it('maps the remaining market statuses 1:1', () => {
    for (const s of [
      'for_sale',
      'under_offer',
      'sold_stc',
      'sold',
      'let_agreed',
      'let',
      'withdrawn',
    ]) {
      expect(toCardStatus(s)).toBe(s);
    }
  });
  it('falls back to for_sale for an unknown status', () => {
    expect(toCardStatus('mystery')).toBe('for_sale');
  });
});

describe('priceQualifier', () => {
  it('gives a qualifier for every status (never a bare price, PRODUCT.md §8)', () => {
    expect(priceQualifier('for_sale')).toBe('Guide price');
    expect(priceQualifier('to_let')).toBe('Asking rent');
    expect(priceQualifier('sold')).toBe('Sold for');
    expect(priceQualifier('let')).toBe('Now let at');
    expect(priceQualifier('unknown')).toBe('Guide price');
  });
});

describe('rentFrequency', () => {
  it('returns PCM for rentals and nothing for sales', () => {
    expect(rentFrequency('rent')).toBe('PCM');
    expect(rentFrequency('sale')).toBeUndefined();
  });
});
