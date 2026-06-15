import { afterEach, describe, expect, it } from 'vitest';

import {
  contractorLinkSecret,
  signContractorLink,
  verifyContractorLink,
} from './contractor-access.js';

// FR-G-8 — the contractor magic-link grants an unauthenticated party scoped access
// to ONE ticket, so the token machinery is held to the same adversarial bar as the
// signed-object tokens: tamper / expiry / wrong-secret all reject, and verify
// returns the attested ids (never caller-supplied ones).

const SECRET = 'contractor-secret';
const REPAIR = '11111111-1111-1111-1111-111111111111';
const CONTRACTOR = '22222222-2222-2222-2222-222222222222';

const saved = process.env['CONTRACTOR_LINK_SECRET'];
afterEach(() => {
  if (saved === undefined) delete process.env['CONTRACTOR_LINK_SECRET'];
  else process.env['CONTRACTOR_LINK_SECRET'] = saved;
});

describe('contractorLinkSecret', () => {
  it('fails closed when unset and returns the configured secret', () => {
    delete process.env['CONTRACTOR_LINK_SECRET'];
    expect(() => contractorLinkSecret()).toThrow(/CONTRACTOR_LINK_SECRET/);
    process.env['CONTRACTOR_LINK_SECRET'] = 's3cret';
    expect(contractorLinkSecret()).toBe('s3cret');
  });
});

describe('signContractorLink / verifyContractorLink', () => {
  const now = 1_700_000_000_000;

  it('round-trips the attested repair + contractor ids', () => {
    const token = signContractorLink(REPAIR, CONTRACTOR, now + 60_000, SECRET);
    expect(verifyContractorLink(token, SECRET, now)).toEqual({
      repairRequestId: REPAIR,
      contractorId: CONTRACTOR,
    });
  });

  it('is deterministic for identical inputs', () => {
    expect(signContractorLink(REPAIR, CONTRACTOR, now + 60_000, SECRET)).toBe(
      signContractorLink(REPAIR, CONTRACTOR, now + 60_000, SECRET),
    );
  });

  it('rejects an expired token', () => {
    const token = signContractorLink(REPAIR, CONTRACTOR, now - 1, SECRET);
    expect(verifyContractorLink(token, SECRET, now)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signContractorLink(REPAIR, CONTRACTOR, now + 60_000, 'other-secret');
    expect(verifyContractorLink(token, SECRET, now)).toBeNull();
  });

  it('rejects a tampered payload (a swapped contractor id does not verify)', () => {
    const token = signContractorLink(REPAIR, CONTRACTOR, now + 60_000, SECRET);
    const [, expiry, sig] = token.split('.');
    const forged = `${Buffer.from(`${REPAIR}:99999999-9999-9999-9999-999999999999`, 'utf8').toString('base64url')}.${expiry}.${sig}`;
    expect(verifyContractorLink(forged, SECRET, now)).toBeNull();
  });

  it('rejects structurally malformed tokens', () => {
    expect(verifyContractorLink('', SECRET, now)).toBeNull();
    expect(verifyContractorLink('a.b', SECRET, now)).toBeNull();
    expect(verifyContractorLink('not.a.token', SECRET, now)).toBeNull();
  });
});
