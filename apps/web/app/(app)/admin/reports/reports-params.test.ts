import { describe, expect, it } from 'vitest';

import { parseReportRange, toDateInputValue } from './reports-params.js';

describe('parseReportRange', () => {
  it('is empty for no params', () => {
    expect(parseReportRange({})).toEqual({});
  });

  it('parses valid from/to dates', () => {
    const range = parseReportRange({ from: '2026-01-01', to: '2026-02-01' });
    expect(range.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('drops invalid / empty dates', () => {
    expect(parseReportRange({ from: 'not-a-date', to: '' })).toEqual({});
  });
});

describe('toDateInputValue', () => {
  it('formats a date as yyyy-mm-dd', () => {
    expect(toDateInputValue(new Date('2026-01-15T09:30:00.000Z'))).toBe('2026-01-15');
  });

  it('is empty for no date', () => {
    expect(toDateInputValue(undefined)).toBe('');
  });
});
