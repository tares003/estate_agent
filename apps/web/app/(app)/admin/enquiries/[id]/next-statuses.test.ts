import { describe, expect, it } from 'vitest';

import { LOST_REASON_OPTIONS, nextStatusOptions } from './next-statuses.js';

describe('nextStatusOptions', () => {
  it('offers the allowed transitions for a new enquiry, with labels', () => {
    expect(nextStatusOptions('new')).toEqual([
      { value: 'contacted', label: 'Contacted' },
      { value: 'archived', label: 'Archived' },
    ]);
  });

  it('offers nothing for a terminal status', () => {
    expect(nextStatusOptions('archived')).toEqual([]);
  });

  it('returns nothing for an unknown status', () => {
    expect(nextStatusOptions('nonsense')).toEqual([]);
  });
});

describe('LOST_REASON_OPTIONS', () => {
  it('exposes every canonical lost reason, labelled', () => {
    expect(LOST_REASON_OPTIONS).toEqual([
      { value: 'price', label: 'Price' },
      { value: 'location', label: 'Location' },
      { value: 'fell_through', label: 'Fell through' },
      { value: 'no_response', label: 'No response' },
      { value: 'other', label: 'Other' },
    ]);
  });
});
