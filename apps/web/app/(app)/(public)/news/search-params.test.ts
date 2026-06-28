import { describe, expect, it } from 'vitest';
import { formatPublishedDate, parseBlogSearch, toNewsQuery } from './search-params.js';

describe('parseBlogSearch', () => {
  it('parses a category + tag slug and a page number', () => {
    expect(parseBlogSearch({ category: 'market-insight', tag: 'sales', page: '3' })).toEqual({
      category: 'market-insight',
      tag: 'sales',
      page: 3,
    });
  });

  it('defaults the page to 1 and omits absent filters', () => {
    expect(parseBlogSearch({})).toEqual({ page: 1 });
  });

  it('drops a malformed slug rather than trusting it', () => {
    const out = parseBlogSearch({ category: 'Not A Slug!', tag: '--bad--' });
    expect(out).not.toHaveProperty('category');
    expect(out).not.toHaveProperty('tag');
  });

  it('lowercases a slug and reads the first value of a repeated param', () => {
    expect(parseBlogSearch({ category: ['Market-Insight', 'other'] })).toMatchObject({
      category: 'market-insight',
    });
  });

  it('clamps a junk or non-positive page to 1', () => {
    expect(parseBlogSearch({ page: 'abc' }).page).toBe(1);
    expect(parseBlogSearch({ page: '-2' }).page).toBe(1);
    expect(parseBlogSearch({ page: '0' }).page).toBe(1);
  });
});

describe('toNewsQuery', () => {
  it('serialises category + tag + page', () => {
    expect(toNewsQuery({ category: 'market-insight', tag: 'sales', page: 2 })).toBe(
      '?category=market-insight&tag=sales&page=2',
    );
  });

  it('omits page=1 so the canonical no-filter URL is empty', () => {
    expect(toNewsQuery({ page: 1 })).toBe('');
    expect(toNewsQuery({})).toBe('');
  });

  it('applies overrides last (a pagination link bumps the page)', () => {
    expect(toNewsQuery({ category: 'guides', page: 1 }, { page: 2 })).toBe(
      '?category=guides&page=2',
    );
  });
});

describe('formatPublishedDate', () => {
  it('formats a UTC date as a readable British date', () => {
    expect(formatPublishedDate(new Date('2026-03-01T09:00:00Z'))).toBe('1 March 2026');
  });
});
