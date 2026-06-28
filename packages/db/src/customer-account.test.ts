import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-T FR-T-1 — the customer account extends the existing `users` table (it is
// also better-auth's user; identity is per-tenant). A registered customer carries
// `type=customer` (the discriminator) and an OPTIONAL marketing opt-in distinct
// from the mandatory GDPR consent (which is logged in consent_logs, not on the
// user). Schema-only unit — asserts the schema source. No raw ADD COLUMN migration
// (prisma db push owns the column; the table already has RLS).

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

function model(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `model ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('User — customer-account fields (EPIC-T FR-T-1)', () => {
  const user = model('User');

  it('discriminates a customer from a staff member via `type`', () => {
    expect(user).toMatch(/type\s+String\s+@default\("staff"\)/);
  });

  it('carries the email-verified flag the FR-T-2 save gate reads', () => {
    expect(user).toMatch(/emailVerified\s+Boolean\s+@default\(false\)\s+@map\("email_verified"\)/);
  });

  it('carries the optional marketing opt-in, defaulting to false (separate from GDPR consent)', () => {
    expect(user).toMatch(
      /marketingOptIn\s+Boolean\s+@default\(false\)\s+@map\("marketing_opt_in"\)/,
    );
  });

  // EPIC-T FR-T-11 — the profile-editable fields a customer manages from
  // /account/profile, alongside the marketing opt-in already asserted above.
  it('carries an OPTIONAL phone the customer can set on their profile (nullable)', () => {
    expect(user).toMatch(/phone\s+String\?/);
  });

  it('carries the email contact preference, defaulting to true (separate from marketing opt-in)', () => {
    expect(user).toMatch(
      /contactByEmail\s+Boolean\s+@default\(true\)\s+@map\("contact_by_email"\)/,
    );
  });

  it('carries the SMS contact preference, defaulting to false', () => {
    expect(user).toMatch(/contactBySms\s+Boolean\s+@default\(false\)\s+@map\("contact_by_sms"\)/);
  });
});
