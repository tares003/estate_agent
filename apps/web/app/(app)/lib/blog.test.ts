import { describe, expect, it, vi } from 'vitest';
import {
  BLOG_PAGE_SIZE,
  getPublishedPostBySlug,
  listPublishedPosts,
  postBodyToSections,
  type BlogPostRow,
  type BlogReader,
} from './blog.js';

const row: BlogPostRow = {
  id: 'p1',
  slug: 'spring-market-2026',
  title: 'The spring market in 2026',
  body: [{ type: 'rich_text', data: { html: '<p>Hello</p>' } }],
  renderedHtmlCache: '<p>Hello</p>',
  excerpt: 'A look at the spring market.',
  heroImageUrl: 'tenants/t1/blog/spring.jpg',
  publishedAt: new Date('2026-03-01T09:00:00Z'),
  metaTitle: 'Spring market 2026',
  metaDescription: 'What to expect this spring.',
  category: { name: 'Market insight', slug: 'market-insight' },
  author: { name: 'Jo Bloggs', slug: 'jo-bloggs' },
  tags: [{ name: 'Sales', slug: 'sales' }],
};

/** A structural reader backed by vi fns, returning the supplied rows / count. */
function makeReader(rows: BlogPostRow[], total = rows.length) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const count = vi.fn().mockResolvedValue(total);
  const findFirst = vi.fn().mockResolvedValue(rows[0] ?? null);
  const db: BlogReader = { blogPost: { findMany, count, findFirst } };
  return { db, findMany, count, findFirst };
}

describe('listPublishedPosts', () => {
  it('returns only published posts, newest-published first, paginated', async () => {
    const { db, findMany, count } = makeReader([row], 1);

    const result = await listPublishedPosts(db);

    // status: published is always part of the predicate (drafts never leak).
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        skip: 0,
        take: BLOG_PAGE_SIZE,
      }),
    );
    expect(count).toHaveBeenCalledWith({ where: { status: 'published' } });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      slug: 'spring-market-2026',
      title: 'The spring market in 2026',
      category: { name: 'Market insight', slug: 'market-insight' },
      author: { name: 'Jo Bloggs', slug: 'jo-bloggs' },
    });
    // The card view model never carries the body / SEO meta.
    expect(result.items[0]).not.toHaveProperty('body');
    expect(result.items[0]).not.toHaveProperty('metaTitle');
  });

  it('filters by category slug when supplied', async () => {
    const { db, findMany } = makeReader([row], 1);

    await listPublishedPosts(db, { category: 'market-insight' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', category: { slug: 'market-insight' } },
      }),
    );
  });

  it('filters by tag slug via a some-relation predicate', async () => {
    const { db, findMany } = makeReader([row], 1);

    await listPublishedPosts(db, { tag: 'sales' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', tags: { some: { slug: 'sales' } } },
      }),
    );
  });

  it('computes pagination from the page + page size (skip / totalPages)', async () => {
    const { db, findMany } = makeReader([row], 25);

    const result = await listPublishedPosts(db, { page: 2, pageSize: 9 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 9, take: 9 }));
    expect(result).toMatchObject({ total: 25, page: 2, pageSize: 9, totalPages: 3 });
  });

  it('clamps a junk page to 1 and a junk page size into range', async () => {
    const { db, findMany } = makeReader([], 0);

    const result = await listPublishedPosts(db, { page: -5, pageSize: 9999 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 60 }));
    // An empty result still reports at least one page.
    expect(result.totalPages).toBe(1);
  });
});

describe('getPublishedPostBySlug', () => {
  it('fetches a single published post by slug with its body + SEO + taxonomy', async () => {
    const { db, findFirst } = makeReader([row]);

    const post = await getPublishedPostBySlug(db, 'spring-market-2026');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'spring-market-2026', status: 'published' } }),
    );
    expect(post).toMatchObject({
      id: 'p1',
      slug: 'spring-market-2026',
      title: 'The spring market in 2026',
      metaTitle: 'Spring market 2026',
      tags: [{ name: 'Sales', slug: 'sales' }],
    });
    expect(post?.body).toEqual([{ type: 'rich_text', data: { html: '<p>Hello</p>' } }]);
  });

  it('returns null when the slug resolves to no published post (drafts never leak)', async () => {
    const { db } = makeReader([]);

    expect(await getPublishedPostBySlug(db, 'ghost')).toBeNull();
  });
});

describe('postBodyToSections', () => {
  it('passes a block array straight through as renderer sections', () => {
    const sections = postBodyToSections([
      { type: 'rich_text', data: { html: '<p>Hi</p>' } },
      { type: 'cta_strip', data: { heading: 'Talk to us' } },
    ]);
    expect(sections).toEqual([
      { type: 'rich_text', data: { html: '<p>Hi</p>' } },
      { type: 'cta_strip', data: { heading: 'Talk to us' } },
    ]);
  });

  it('drops entries that lack a string type, and yields [] for non-array bodies', () => {
    expect(postBodyToSections([{ data: { x: 1 } }, null, 'nope'])).toEqual([]);
    expect(postBodyToSections(null)).toEqual([]);
    expect(postBodyToSections({ type: 'rich_text' })).toEqual([]);
  });
});
