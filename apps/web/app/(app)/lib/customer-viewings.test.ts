// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  listCustomerViewings,
  resolveVerifiedCustomerEmail,
  type VerifiedEmailReader,
  type ViewingHistoryReader,
} from './customer-viewings.js';

// EPIC-T FR-T-9 — the viewing-requests history read model. The data model carries no
// owner FK from a viewing to an account, so viewing requests are matched to the
// customer by their VERIFIED account email (a directed decision — see the PR). Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free); the live read runs
// tenant-scoped (RLS) via withTenant in the /account/viewings route. Newest-first.

const EMAIL = 'ada@example.invalid';
const USER = 'c1';

function historyReader(rows: unknown[]): {
  r: ViewingHistoryReader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(async () => rows);
  return { r: { enquiry: { findMany } } as unknown as ViewingHistoryReader, findMany };
}

describe('listCustomerViewings', () => {
  it('matches viewing-request enquiries by the verified email, newest-first, joined to the property', async () => {
    const { r, findMany } = historyReader([
      {
        id: 'v2',
        status: 'viewing_booked',
        createdAt: new Date('2026-06-02T09:00:00Z'),
        property: {
          title: '2-bed flat, Didsbury',
          slug: 'two-bed-flat-didsbury',
          displayAddress: '1 Elm Road, Didsbury',
        },
      },
      {
        id: 'v1',
        status: 'new',
        createdAt: new Date('2026-06-01T09:00:00Z'),
        property: { title: null, slug: 'studio-central', displayAddress: '9 Oak Street, Central' },
      },
    ]);

    const result = await listCustomerViewings(r, EMAIL);

    // Ordering is delegated to the DB and preserved by the mapping (newest-first).
    expect(result.map((row) => row.id)).toEqual(['v2', 'v1']);
    expect(result[0]!.status).toBe('viewing_booked');
    expect(result[0]!.propertyLabel).toBe('2-bed flat, Didsbury');
    expect(result[0]!.propertySlug).toBe('two-bed-flat-didsbury');
    expect(result[0]!.requestedAt).toEqual(new Date('2026-06-02T09:00:00Z'));
    // A null property title falls back to the display address so the row always has a label.
    expect(result[1]!.propertyLabel).toBe('9 Oak Street, Central');

    // Scopes the read to the verified email + the viewing-request channel, newest-first.
    // `lead_type` asserted via bracket access (the forbidden noun stays out of a key).
    const args = findMany.mock.calls[0]![0];
    expect(args.where.email).toBe(EMAIL);
    expect(args.where['leadType']).toBe('viewing_request');
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('labels a viewing whose property has been removed and drops its link', async () => {
    const { r } = historyReader([
      { id: 'v1', status: 'new', createdAt: new Date('2026-06-01T09:00:00Z'), property: null },
    ]);

    const [row] = await listCustomerViewings(r, EMAIL);

    expect(row!.propertyLabel).toBe('Property no longer available');
    expect(row!.propertySlug).toBeNull();
  });

  it('returns an empty list when the customer has no viewing requests', async () => {
    const { r } = historyReader([]);
    expect(await listCustomerViewings(r, EMAIL)).toEqual([]);
  });
});

function emailReader(user: { email: string } | null): {
  r: VerifiedEmailReader;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn(async () => user);
  return { r: { user: { findFirst } } as unknown as VerifiedEmailReader, findFirst };
}

describe('resolveVerifiedCustomerEmail', () => {
  it('resolves the account email, pinned to a verified customer row', async () => {
    const { r, findFirst } = emailReader({ email: EMAIL });

    expect(await resolveVerifiedCustomerEmail(r, USER)).toBe(EMAIL);

    const args = findFirst.mock.calls[0]![0];
    expect(args.where.id).toBe(USER);
    expect(args.where.type).toBe('customer');
    expect(args.where.emailVerified).toBe(true);
  });

  it('resolves null when there is no verified customer row (unverified email or a staff id)', async () => {
    const { r } = emailReader(null);
    expect(await resolveVerifiedCustomerEmail(r, USER)).toBeNull();
  });
});
