import { describe, expect, it } from 'vitest';

import { MARKET_STATUSES, marketStatusUpdateSchema } from './market-status.js';

const id = '11111111-1111-1111-1111-111111111111';

describe('MARKET_STATUSES', () => {
  it('mirrors the committed MarketStatus enum values', () => {
    expect(MARKET_STATUSES).toEqual([
      'for_sale',
      'under_offer',
      'sold_stc',
      'sold',
      'to_let',
      'let_agreed',
      'let',
      'withdrawn',
    ]);
  });
});

describe('marketStatusUpdateSchema', () => {
  it('accepts a valid status change', () => {
    expect(marketStatusUpdateSchema.safeParse({ id, marketStatus: 'under_offer' }).success).toBe(
      true,
    );
  });

  it('rejects an unknown status and a non-uuid id', () => {
    expect(marketStatusUpdateSchema.safeParse({ id, marketStatus: 'pending' }).success).toBe(false);
    expect(marketStatusUpdateSchema.safeParse({ id: 'nope', marketStatus: 'sold' }).success).toBe(
      false,
    );
  });
});
