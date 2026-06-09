import { describe, expect, it, vi } from 'vitest';

vi.mock('./lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));

const { default: robots } = await import('./robots.js');

describe('robots', () => {
  it('allows the public site, disallows the protected paths, and references the sitemap (FR-O-9)', async () => {
    const result = await robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules).toMatchObject({ userAgent: '*', allow: '/' });
    expect(rules?.disallow).toEqual(
      expect.arrayContaining(['/admin', '/account', '/api/', '/preview/']),
    );
    expect(result.sitemap).toBe('https://acme.test/sitemap.xml');
  });
});
