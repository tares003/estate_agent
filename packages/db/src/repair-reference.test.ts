import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-G ticket reference (master spec §G.1/§G.6, FR-G-3). §G.6 defines
// `reference` as the human-readable ticket number ("RPR-2026-04321") and marks it
// UNIQUE — mapped per-tenant in the multi-tenant platform. The tenant's free-text
// property pointer lives in its own `property_reference` column (the §G.6 property
// address block, collapsed to the committed single-field shape). Schema-only unit:
// asserts the schema source text.

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');

function modelBlock(model: string): string {
  const match = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `model ${model} should be declared`).not.toBeNull();
  return match![0];
}

describe('RepairRequest — ticket reference (§G.6)', () => {
  it('keeps the ticket number per-tenant unique', () => {
    const block = modelBlock('RepairRequest');
    expect(block).toContain('@@unique([tenantId, reference])');
  });

  it('carries the property pointer in its own column', () => {
    const block = modelBlock('RepairRequest');
    expect(block).toMatch(/propertyReference\s+String\?\s+@map\("property_reference"\)/);
  });
});
