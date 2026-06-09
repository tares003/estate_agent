// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  filterPublicNav,
  navItemSchema,
  payloadMenuItemToNav,
  payloadMenuToNav,
  type NavItem,
  type PayloadMenuItem,
} from './menu-mapper.js';

// EPIC-D FR-D-7 (B24): the pure mapper turns a Payload `menus` doc into a plain,
// renderer-ready nav tree. Mirrors cms-mapper.ts: no Payload imports, node-env
// unit-testable, fail-soft, null-stripping, with a round-trip through the Zod
// schema the renderer consumes. Role-based visibility is NOT decided here (the
// pure mapper has no viewer context) — roles are passed through and the public
// layout filters them.

const item = (over: Partial<PayloadMenuItem> = {}): PayloadMenuItem => ({
  label: 'Buy',
  url: '/properties?saleType=sale',
  target: 'same',
  icon: null,
  roles: null,
  visibility: true,
  ...over,
});

describe('payloadMenuToNav', () => {
  it('returns null for a null/undefined doc', () => {
    expect(payloadMenuToNav(null)).toBeNull();
    expect(payloadMenuToNav(undefined)).toBeNull();
  });

  it('returns an empty item list when items is missing or not an array', () => {
    expect(payloadMenuToNav({ location: 'header' })).toEqual({ location: 'header', items: [] });
    expect(payloadMenuToNav({ location: 'header', items: 'nope' as never })).toEqual({
      location: 'header',
      items: [],
    });
  });

  it('preserves item order', () => {
    const menu = payloadMenuToNav({
      location: 'header',
      items: [item({ label: 'Buy' }), item({ label: 'Rent' }), item({ label: 'Sell' })],
    });
    expect(menu?.items.map((i) => i.label)).toEqual(['Buy', 'Rent', 'Sell']);
  });

  it('drops malformed (null / non-object) items defensively', () => {
    const menu = payloadMenuToNav({
      location: 'header',
      items: [null as never, 'oops' as never, item({ label: 'OK', url: '/ok' })],
    });
    expect(menu?.items.map((i) => i.label)).toEqual(['OK']);
  });
});

describe('payloadMenuItemToNav', () => {
  it('maps url -> href and normalises a missing/null target to "same"', () => {
    const nav = payloadMenuItemToNav(item({ url: '/contact', target: null }));
    expect(nav).toMatchObject({ href: '/contact', target: 'same' });
  });

  it('preserves target "new"', () => {
    expect(payloadMenuItemToNav(item({ target: 'new' }))?.target).toBe('new');
  });

  it('drops an invisible item (visibility:false)', () => {
    expect(payloadMenuItemToNav(item({ visibility: false }))).toBeNull();
  });

  it('keeps a visible item (visibility true or absent)', () => {
    expect(payloadMenuItemToNav(item({ visibility: true }))).not.toBeNull();
    const { visibility, ...noVis } = item();
    void visibility;
    expect(payloadMenuItemToNav(noVis)).not.toBeNull();
  });

  it('drops an item missing a label or url (fail-soft, no broken links)', () => {
    expect(payloadMenuItemToNav(item({ label: undefined }))).toBeNull();
    expect(payloadMenuItemToNav(item({ url: undefined }))).toBeNull();
  });

  it('strips null icon/roles so the optional schema fields validate', () => {
    const nav = payloadMenuItemToNav(item({ icon: null, roles: null }));
    expect(nav).toEqual({ label: 'Buy', href: '/properties?saleType=sale', target: 'same' });
  });

  it('passes a non-empty roles array through (role gating is applied downstream)', () => {
    const nav = payloadMenuItemToNav(item({ roles: ['content_editor'] }));
    expect(nav?.roles).toEqual(['content_editor']);
  });

  it('coerces roles to a clean string[] (drops non-string elements)', () => {
    const nav = payloadMenuItemToNav(
      item({ roles: ['content_editor', 5, null, 'super_admin'] as never }),
    );
    expect(nav?.roles).toEqual(['content_editor', 'super_admin']);
  });

  it('drops a non-array roles value (never emits an invalid roles)', () => {
    const nav = payloadMenuItemToNav(item({ roles: 'super_admin' as never }));
    expect(nav && 'roles' in nav).toBe(false);
  });

  it('recurses children exactly one level (grandchildren are ignored)', () => {
    const nav = payloadMenuItemToNav(
      item({
        label: 'Sell',
        url: '/valuation',
        children: [
          item({
            label: 'Valuation',
            url: '/valuation',
            children: [item({ label: 'Deep', url: '/deep' })],
          }),
        ],
      }),
    );
    expect(nav?.children?.map((c) => c.label)).toEqual(['Valuation']);
    expect((nav?.children?.[0] as { children?: unknown }).children).toBeUndefined();
  });

  it('drops invisible / invalid children', () => {
    const nav = payloadMenuItemToNav(
      item({
        children: [item({ label: 'OK', url: '/ok' }), item({ label: 'Hidden', visibility: false })],
      }),
    );
    expect(nav?.children?.map((c) => c.label)).toEqual(['OK']);
  });
});

describe('filterPublicNav (anonymous viewer role gate)', () => {
  const leaf = (label: string, roles?: string[]): NavItem => ({
    label,
    href: `/${label.toLowerCase()}`,
    target: 'same',
    ...(roles ? { roles } : {}),
  });

  it('keeps items with no role gate and drops staff-only items', () => {
    const out = filterPublicNav([leaf('Buy'), leaf('Admin', ['content_editor']), leaf('Contact')]);
    expect(out.map((i) => i.label)).toEqual(['Buy', 'Contact']);
  });

  it('keeps an item with an empty roles array (empty = everyone)', () => {
    expect(filterPublicNav([leaf('Buy', [])]).map((i) => i.label)).toEqual(['Buy']);
  });

  it('drops role-gated children while keeping the public parent', () => {
    const parent: NavItem = {
      ...leaf('Sell'),
      children: [leaf('Public'), leaf('Staff', ['super_admin'])],
    };
    const [out] = filterPublicNav([parent]);
    expect(out?.children?.map((c) => c.label)).toEqual(['Public']);
  });
});

describe('mapper output validates against navItemSchema', () => {
  it('every produced item round-trips through the schema', () => {
    const menu = payloadMenuToNav({
      location: 'header',
      items: [
        item({ label: 'Buy', icon: null, roles: null }),
        item({
          label: 'Sell',
          url: '/valuation',
          target: 'new',
          children: [item({ label: 'Book', url: '/book' })],
        }),
      ],
    });
    for (const navItem of menu?.items ?? []) {
      expect(navItemSchema.safeParse(navItem).success).toBe(true);
    }
  });
});
