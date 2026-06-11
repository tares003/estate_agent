import { describe, expect, it } from 'vitest';

import { repairReference } from './repair-reference.js';

describe('repairReference', () => {
  it('formats the §G.1 human-readable ticket number', () => {
    expect(repairReference(new Date('2026-06-11T10:00:00.000Z'), 42)).toBe('RPR-2026-00042');
    expect(repairReference(new Date('2026-06-11T10:00:00.000Z'), 4321)).toBe('RPR-2026-04321');
  });

  it('does not truncate past five digits', () => {
    expect(repairReference(new Date('2027-01-01T00:00:00.000Z'), 123456)).toBe('RPR-2027-123456');
  });
});
