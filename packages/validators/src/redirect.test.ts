import { describe, expect, it } from 'vitest';

import { REDIRECT_TYPES, redirectCreateSchema, redirectUpdateSchema } from './redirect.js';

// EPIC-O FR-O-11 — the managed redirect-rule schema. A from-path must be root-
// relative (start with `/`); a destination is required; the type is one of the
// Prisma RedirectType values. The update schema additionally requires the rule id.

const VALID_CREATE = {
  sourcePath: '/old-path',
  destinationPath: '/new-path',
  type: 'r301' as const,
};

describe('redirectCreateSchema', () => {
  it('accepts a valid create input', () => {
    const parsed = redirectCreateSchema.safeParse(VALID_CREATE);
    expect(parsed.success).toBe(true);
  });

  it('trims and accepts each redirect type', () => {
    for (const type of REDIRECT_TYPES) {
      const parsed = redirectCreateSchema.safeParse({ ...VALID_CREATE, type });
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects a source path that does not start with /', () => {
    const parsed = redirectCreateSchema.safeParse({ ...VALID_CREATE, sourcePath: 'old-path' });
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty source path', () => {
    const parsed = redirectCreateSchema.safeParse({ ...VALID_CREATE, sourcePath: '' });
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty destination', () => {
    const parsed = redirectCreateSchema.safeParse({ ...VALID_CREATE, destinationPath: '' });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown redirect type', () => {
    const parsed = redirectCreateSchema.safeParse({ ...VALID_CREATE, type: '410' });
    expect(parsed.success).toBe(false);
  });

  it('trims surrounding whitespace from the paths', () => {
    const parsed = redirectCreateSchema.safeParse({
      ...VALID_CREATE,
      sourcePath: '  /old-path  ',
      destinationPath: '  /new-path  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sourcePath).toBe('/old-path');
      expect(parsed.data.destinationPath).toBe('/new-path');
    }
  });
});

describe('redirectUpdateSchema', () => {
  it('accepts a valid update input with a uuid id', () => {
    const parsed = redirectUpdateSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      ...VALID_CREATE,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an update without a valid id', () => {
    const parsed = redirectUpdateSchema.safeParse({ id: 'not-a-uuid', ...VALID_CREATE });
    expect(parsed.success).toBe(false);
  });
});
