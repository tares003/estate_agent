import { describe, expect, it } from 'vitest';

import { contactListQuery, parseContactListParams } from './contacts-params.js';

describe('parseContactListParams', () => {
  it('is empty for no params', () => {
    expect(parseContactListParams({})).toEqual({});
  });

  it('parses a valid type and a page beyond 1', () => {
    expect(parseContactListParams({ type: 'vendor', page: '2' })).toEqual({
      type: 'vendor',
      page: 2,
    });
  });

  it('drops an unknown type and page 1 / non-numeric pages', () => {
    expect(parseContactListParams({ type: 'applicant', page: '1' })).toEqual({});
    expect(parseContactListParams({ page: 'x' })).toEqual({});
  });
});

describe('contactListQuery', () => {
  it('is empty for the default view', () => {
    expect(contactListQuery({})).toBe('');
  });

  it('serialises the type, omitting page 1', () => {
    expect(contactListQuery({ type: 'buyer', page: 1 })).toBe('?type=buyer');
  });

  it('overrides the page for pagination links while keeping the filter', () => {
    expect(contactListQuery({ type: 'buyer' }, 3)).toBe('?type=buyer&page=3');
  });
});
