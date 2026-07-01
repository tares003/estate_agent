import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';

import { applySeoOverride, type SeoOverride } from './seo-override.js';

// EPIC-O FR-O-4 — the pure override → default `Metadata` merge. Asserts the
// precedence contract (override wins when present, base preserved when absent),
// the noindex / nofollow robots emission, the canonical replacement and the OG /
// Twitter image + title propagation. Pure + IO-free, so no mocks are needed.

const BASE: Metadata = {
  title: 'Default title',
  description: 'Default description',
  alternates: { canonical: 'https://acme.test/properties/palatine-road-m20' },
  openGraph: {
    title: 'Default title',
    description: 'Default description',
    url: 'https://acme.test/properties/palatine-road-m20',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Default title', description: 'Default description' },
};

function override(over: Partial<SeoOverride> = {}): SeoOverride {
  return {
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    ogImage: null,
    noIndex: false,
    noFollow: false,
    ...over,
  };
}

describe('applySeoOverride', () => {
  it('returns the base unchanged when there is no override row', () => {
    expect(applySeoOverride(BASE, null)).toEqual(BASE);
  });

  it('does not mutate the base object', () => {
    const snapshot = structuredClone(BASE);
    applySeoOverride(BASE, override({ metaTitle: 'New', canonicalUrl: 'https://x.test/' }));
    expect(BASE).toEqual(snapshot);
  });

  it('keeps every default when the override sets no field', () => {
    expect(applySeoOverride(BASE, override())).toEqual(BASE);
  });

  it('lets an override metaTitle win over the default title', () => {
    const meta = applySeoOverride(BASE, override({ metaTitle: 'Override title' }));
    expect(meta.title).toBe('Override title');
    expect((meta.openGraph as { title?: string }).title).toBe('Override title');
    expect((meta.twitter as { title?: string }).title).toBe('Override title');
  });

  it('lets an override metaDescription win over the default description', () => {
    const meta = applySeoOverride(BASE, override({ metaDescription: 'Override description' }));
    expect(meta.description).toBe('Override description');
    expect((meta.openGraph as { description?: string }).description).toBe('Override description');
    expect((meta.twitter as { description?: string }).description).toBe('Override description');
  });

  it('keeps the default title / description when the override values are blank', () => {
    const meta = applySeoOverride(BASE, override({ metaTitle: '   ', metaDescription: '' }));
    expect(meta.title).toBe('Default title');
    expect(meta.description).toBe('Default description');
  });

  it('replaces the canonical URL when the override sets one', () => {
    const meta = applySeoOverride(
      BASE,
      override({ canonicalUrl: 'https://acme.test/canonical-elsewhere' }),
    );
    expect(meta.alternates?.canonical).toBe('https://acme.test/canonical-elsewhere');
  });

  it('keeps the default canonical when the override omits it', () => {
    const meta = applySeoOverride(BASE, override({ metaTitle: 'X' }));
    expect(meta.alternates?.canonical).toBe(
      'https://acme.test/properties/palatine-road-m20',
    );
  });

  it('sets the OG + Twitter image from the override ogImage', () => {
    const meta = applySeoOverride(
      BASE,
      override({ ogImage: 'https://acme.test/social/hero.jpg' }),
    );
    expect((meta.openGraph as { images?: unknown[] }).images).toEqual([
      'https://acme.test/social/hero.jpg',
    ]);
    expect((meta.twitter as { images?: unknown[] }).images).toEqual([
      'https://acme.test/social/hero.jpg',
    ]);
  });

  it('emits robots noindex + nofollow when both flags are set', () => {
    const meta = applySeoOverride(BASE, override({ noIndex: true, noFollow: true }));
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('emits robots for a noindex-only override (still followable)', () => {
    const meta = applySeoOverride(BASE, override({ noIndex: true }));
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('emits robots for a nofollow-only override (still indexable)', () => {
    const meta = applySeoOverride(BASE, override({ noFollow: true }));
    expect(meta.robots).toEqual({ index: true, follow: false });
  });

  it('leaves robots unset when neither flag is set (preserves default behaviour)', () => {
    const meta = applySeoOverride(BASE, override({ metaTitle: 'X' }));
    expect(meta.robots).toBeUndefined();
  });

  it('does not invent an openGraph block when the base has none', () => {
    const bare: Metadata = { title: 'Only title' };
    const meta = applySeoOverride(bare, override({ metaTitle: 'New', ogImage: 'https://x/y.jpg' }));
    expect(meta.title).toBe('New');
    expect(meta.openGraph).toBeUndefined();
    expect(meta.twitter).toBeUndefined();
  });

  it('applies title, description, canonical, image and robots together', () => {
    const meta = applySeoOverride(
      BASE,
      override({
        metaTitle: 'All override',
        metaDescription: 'All description',
        canonicalUrl: 'https://acme.test/all',
        ogImage: 'https://acme.test/all.jpg',
        noIndex: true,
        noFollow: false,
      }),
    );
    expect(meta.title).toBe('All override');
    expect(meta.description).toBe('All description');
    expect(meta.alternates?.canonical).toBe('https://acme.test/all');
    expect((meta.openGraph as { images?: unknown[] }).images).toEqual(['https://acme.test/all.jpg']);
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});
