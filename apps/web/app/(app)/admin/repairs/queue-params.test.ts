import { describe, expect, it } from 'vitest';

import { parseRepairQueueParams, repairQueueQuery } from './queue-params.js';

describe('parseRepairQueueParams', () => {
  it('parses status, urgency, sort and page', () => {
    expect(
      parseRepairQueueParams({
        status: 'work_in_progress',
        urgency: 'emergency',
        sort: 'oldest',
        page: '3',
      }),
    ).toEqual({ status: 'work_in_progress', urgency: 'emergency', sort: 'oldest', page: 3 });
  });

  it('drops invalid values and defaults to an empty option set', () => {
    expect(
      parseRepairQueueParams({ status: 'nope', urgency: 'whenever', sort: 'sideways', page: '0' }),
    ).toEqual({});
    expect(parseRepairQueueParams({})).toEqual({});
  });

  it('takes the first value of a repeated param', () => {
    expect(parseRepairQueueParams({ status: ['triaged', 'new'] })).toEqual({ status: 'triaged' });
  });
});

describe('repairQueueQuery', () => {
  it('serialises the active options, with an optional page override', () => {
    expect(repairQueueQuery({ status: 'new', urgency: 'urgent' }, 2)).toBe(
      '?status=new&urgency=urgent&page=2',
    );
    expect(repairQueueQuery({})).toBe('');
    expect(repairQueueQuery({ page: 1 })).toBe('');
  });
});
