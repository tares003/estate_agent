import { describe, expect, it } from 'vitest';

import { isUuid } from './uuid.js';

// The well-formedness check standing between a `[id]` route segment and a Postgres uuid
// column. Prisma throws P2023 on a malformed uuid rather than returning no row, so an
// unvalidated segment became an unhandled 500 where a 404 was the honest answer.

describe('isUuid', () => {
  it('accepts a canonical UUID, in either case', () => {
    expect(isUuid('00000000-0000-0000-0000-000000000001')).toBe(true);
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true);
    expect(isUuid('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toBe(true);
  });

  it('rejects the route segments that actually crashed the page', () => {
    // `/admin/properties/new` is a real static route, but any stale or truncated link
    // lands on the [id] segment and used to reach the database.
    expect(isUuid('new')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('undefined')).toBe(false);
    expect(isUuid('')).toBe(false);
  });

  it('rejects a near-miss: right shape, wrong length or a non-hex digit', () => {
    expect(isUuid('00000000-0000-0000-0000-00000000001')).toBe(false); // 11 in the last group
    expect(isUuid('00000000-0000-0000-0000-0000000000012')).toBe(false); // 13
    expect(isUuid('gggggggg-0000-0000-0000-000000000001')).toBe(false); // non-hex
    expect(isUuid('00000000000000000000000000000001')).toBe(false); // no hyphens
  });

  it('rejects a UUID with anything appended or prepended (no partial match)', () => {
    // The regex is anchored — a segment that merely CONTAINS a uuid is still not one, and
    // must not be handed to the database.
    expect(isUuid(' 00000000-0000-0000-0000-000000000001')).toBe(false);
    expect(isUuid('00000000-0000-0000-0000-000000000001/edit')).toBe(false);
    expect(isUuid("00000000-0000-0000-0000-000000000001' OR 1=1--")).toBe(false);
  });
});
