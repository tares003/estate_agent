import { describe, expect, it } from 'vitest';

import { auditQuery, parseAuditParams } from './audit-params.js';

describe('parseAuditParams', () => {
  it('is empty for no params', () => {
    expect(parseAuditParams({})).toEqual({});
  });

  it('parses an entity filter (trimmed) and a page beyond 1', () => {
    expect(parseAuditParams({ entity: ' enquiry ', page: '2' })).toEqual({
      entity: 'enquiry',
      page: 2,
    });
  });

  it('drops an empty entity and page 1 / non-numeric pages', () => {
    expect(parseAuditParams({ entity: '   ', page: '1' })).toEqual({});
    expect(parseAuditParams({ page: 'x' })).toEqual({});
  });
});

describe('auditQuery', () => {
  it('is empty for the default view', () => {
    expect(auditQuery({})).toBe('');
  });

  it('serialises the entity filter, omitting page 1', () => {
    expect(auditQuery({ entity: 'enquiry', page: 1 })).toBe('?entity=enquiry');
  });

  it('overrides the page for pagination links while keeping the filter', () => {
    expect(auditQuery({ entity: 'enquiry' }, 3)).toBe('?entity=enquiry&page=3');
  });
});
