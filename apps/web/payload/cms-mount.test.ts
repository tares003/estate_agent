// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { tenantScopedAccess } from './access/tenant.js';
import { CMS_ADMIN_ROUTE, CMS_API_ROUTE, CMS_DB_SCHEMA } from './cms-config.js';
import { CmsUsers } from './collections/CmsUsers.js';
import { Media } from './collections/Media.js';
import { Pages } from './collections/Pages.js';

// Contract tests for the Payload CMS mount (EPIC-D / CLAUDE.md §9). The mount's
// wiring (route group, withPayload, REST/GraphQL handlers) is verified by
// `next build` + a runtime smoke; these lock the load-bearing config the rest of
// the platform depends on: the /admin/cms surface, the schema isolation, and the
// collection contracts the page renderer (B23.4) + access scoping (B23.3) consume.

/** Field names declared on a collection (named fields only). */
function fieldNames(fields: typeof Pages.fields): string[] {
  return fields.flatMap((field) =>
    'name' in field && typeof field.name === 'string' ? [field.name] : [],
  );
}

describe('CMS mount constants', () => {
  it('mounts the admin and API under /admin/cms (matches the proxy exemption + route group)', () => {
    expect(CMS_ADMIN_ROUTE).toBe('/admin/cms');
    expect(CMS_API_ROUTE).toBe('/admin/cms/api');
    // The API must sit under the admin prefix so the proxy's /admin/cms exemption
    // (proxy.ts) covers it too.
    expect(CMS_API_ROUTE.startsWith(CMS_ADMIN_ROUTE)).toBe(true);
  });

  it('isolates Payload tables in a dedicated Postgres schema (never Prisma public)', () => {
    expect(CMS_DB_SCHEMA).toBe('payload');
    expect(CMS_DB_SCHEMA).not.toBe('public');
  });
});

describe('Pages collection (EPIC-D managed pages)', () => {
  it('is the `pages` collection with draft/publish versions', () => {
    expect(Pages.slug).toBe('pages');
    expect((Pages.versions as { drafts?: unknown }).drafts).toBe(true);
  });

  it('declares the title + slug fields the renderer routes on', () => {
    expect(fieldNames(Pages.fields)).toEqual(expect.arrayContaining(['title', 'slug']));
  });

  it('scopes reads to the current tenant (no cross-tenant content leak)', () => {
    expect(Pages.access?.read).toBe(tenantScopedAccess);
  });
});

describe('Media collection', () => {
  it('is the `media` upload collection writing to a local static dir', () => {
    expect(Media.slug).toBe('media');
    const upload = Media.upload as { staticDir?: unknown };
    expect(typeof upload.staticDir).toBe('string');
  });

  it('scopes reads to the current tenant', () => {
    expect(Media.access?.read).toBe(tenantScopedAccess);
  });
});

describe('CmsUsers collection (editor accounts)', () => {
  it('is the auth collection named cms_users (never collides with Prisma users)', () => {
    expect(CmsUsers.slug).toBe('cms_users');
    expect(CmsUsers.slug).not.toBe('users');
    expect(CmsUsers.auth).toBe(true);
    expect(CmsUsers.admin?.useAsTitle).toBe('email');
  });

  it('restricts reads to authenticated requests', () => {
    const read = CmsUsers.access?.read;
    expect(read).toBeTypeOf('function');
    expect(read?.({ req: { user: null } } as never)).toBe(false);
    expect(read?.({ req: { user: { id: 'u1' } } } as never)).toBe(true);
  });
});
