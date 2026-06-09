import { describe, expect, it } from 'vitest';

import { enquiryQueueQuery, parseEnquiryQueueParams } from './queue-params.js';

describe('parseEnquiryQueueParams', () => {
  it('is empty for no params (the default open-work view)', () => {
    expect(parseEnquiryQueueParams({})).toEqual({});
  });

  it('parses a valid status, oldest sort, and a page beyond 1', () => {
    expect(parseEnquiryQueueParams({ status: 'contacted', sort: 'oldest', page: '3' })).toEqual({
      status: 'contacted',
      sort: 'oldest',
      page: 3,
    });
  });

  it('drops an unknown status, a non-oldest sort, and page 1 / non-numeric pages', () => {
    expect(parseEnquiryQueueParams({ status: 'sold', sort: 'newest', page: '1' })).toEqual({});
    expect(parseEnquiryQueueParams({ page: 'abc' })).toEqual({});
  });

  it('takes the first value when a param repeats', () => {
    expect(parseEnquiryQueueParams({ status: ['new', 'lost'] })).toEqual({ status: 'new' });
  });
});

describe('enquiryQueueQuery', () => {
  it('is empty for the default view', () => {
    expect(enquiryQueueQuery({})).toBe('');
  });

  it('serialises status + sort, omitting page 1', () => {
    expect(enquiryQueueQuery({ status: 'new', sort: 'oldest', page: 1 })).toBe(
      '?status=new&sort=oldest',
    );
  });

  it('overrides the page for pagination links while keeping the filter', () => {
    expect(enquiryQueueQuery({ status: 'new' }, 4)).toBe('?status=new&page=4');
  });
});
