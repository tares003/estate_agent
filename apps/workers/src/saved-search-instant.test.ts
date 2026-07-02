import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CandidateProperty } from './saved-search-match.js';
import {
  INSTANT_CADENCE,
  listInstantSavedSearches,
  processInstantMatches,
  processSavedSearchInstant,
  processTenantInstantAlerts,
  runInstantAlertsTick,
  type InstantSavedSearch,
  type SavedSearchInstantClient,
} from './saved-search-instant.js';

const TENANT = '00000000-0000-0000-0000-000000000001';
const NOW = new Date('2026-06-28T07:05:00Z');

function instantSearch(over: Partial<InstantSavedSearch> = {}): InstantSavedSearch {
  return {
    id: 's1',
    userId: 'u1',
    name: 'Didsbury 2-beds',
    recipient: 'tess@example.com',
    filters: { unit: 'mi', sort: 'newest', page: 1 } as InstantSavedSearch['filters'],
    lastAlertSentAt: new Date('2026-06-28T07:00:00Z'),
    ...over,
  };
}

function property(over: Partial<CandidateProperty> = {}): CandidateProperty {
  return {
    id: 'p1',
    slug: 'a-flat',
    displayAddress: '1 High Street',
    postcode: 'M20 2AB',
    title: 'A lovely flat',
    saleType: 'sale',
    listingType: 'residential',
    marketStatus: 'for_sale',
    price: 25_000_000,
    bedrooms: 2,
    bathrooms: 1,
    town: 'Didsbury',
    publishedAt: new Date('2026-06-28T07:03:00Z'),
    deletedAt: null,
    ...over,
  };
}

function makeTx() {
  return {
    savedSearch: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    property: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

type Tx = ReturnType<typeof makeTx>;

function runnerFor(tx: Tx) {
  return async <T>(fn: (c: SavedSearchInstantClient) => Promise<T>): Promise<T> =>
    fn(tx as unknown as SavedSearchInstantClient);
}

describe('INSTANT_CADENCE', () => {
  it('is the instant alert frequency (distinct from the daily/weekly digest cadences)', () => {
    expect(INSTANT_CADENCE).toBe('instant');
  });
});

describe('listInstantSavedSearches', () => {
  it('lists saved searches on the instant cadence, joined to the owning user email', async () => {
    const tx = makeTx();
    tx.savedSearch.findMany.mockResolvedValue([
      {
        id: 's1',
        userId: 'u1',
        name: 'Didsbury 2-beds',
        filters: { page: 1 },
        lastAlertSentAt: null,
        user: { email: 'tess@example.com' },
      },
    ]);

    const rows = await listInstantSavedSearches(tx as unknown as SavedSearchInstantClient);

    expect(tx.savedSearch.findMany).toHaveBeenCalledWith({
      where: { alertFrequency: 'instant' },
      select: {
        id: true,
        userId: true,
        name: true,
        filters: true,
        lastAlertSentAt: true,
        user: { select: { email: true } },
      },
    });
    expect(rows).toEqual([
      {
        id: 's1',
        userId: 'u1',
        name: 'Didsbury 2-beds',
        recipient: 'tess@example.com',
        filters: { page: 1 },
        lastAlertSentAt: null,
      },
    ]);
  });
});

describe('processInstantMatches', () => {
  it('returns the candidates that match the filters and are new since the cutoff', () => {
    const search = instantSearch({ lastAlertSentAt: new Date('2026-06-28T07:00:00Z') });
    const matches = processInstantMatches(search, [
      property({ id: 'fresh', publishedAt: new Date('2026-06-28T07:03:00Z') }),
      property({ id: 'stale', publishedAt: new Date('2026-06-28T06:50:00Z') }),
      property({ id: 'wrong-beds', bedrooms: 0, publishedAt: new Date('2026-06-28T07:04:00Z') }),
    ]);
    expect(matches.map((p) => p.id)).toEqual(['fresh']);
  });

  it('returns no matches for an empty candidate set', () => {
    expect(processInstantMatches(instantSearch(), [])).toEqual([]);
  });
});

describe('listCandidateProperties (via processSavedSearchInstant read window)', () => {
  it('reads published, non-deleted properties published after the cutoff', async () => {
    const tx = makeTx();
    await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch({ lastAlertSentAt: new Date('2026-06-28T07:00:00Z') }),
      now: NOW,
    });
    expect(tx.property.findMany).toHaveBeenCalledWith({
      where: { publishedAt: { gt: new Date('2026-06-28T07:00:00Z') }, deletedAt: null },
    });
  });

  it('reads all published, non-deleted properties when the cutoff is null (first poll)', async () => {
    const tx = makeTx();
    await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch({ lastAlertSentAt: null }),
      now: NOW,
    });
    expect(tx.property.findMany).toHaveBeenCalledWith({
      where: { publishedAt: { not: null }, deletedAt: null },
    });
  });
});

describe('processSavedSearchInstant', () => {
  let tx: Tx;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
  });

  it('queues ONE alert email, advances the cursor, and audits when there are new matches', async () => {
    tx.property.findMany.mockResolvedValue([property({ id: 'p1' }), property({ id: 'p2' })]);

    const outcome = await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch(),
      now: NOW,
    });

    expect(outcome).toBe('emailed');
    expect(tx.notificationLog.create).toHaveBeenCalledTimes(1);
    const created = tx.notificationLog.create.mock.calls[0]![0].data;
    expect(created).toMatchObject({
      tenantId: TENANT,
      event: 'saved_search.digest',
      channel: 'email',
      recipient: 'tess@example.com',
      status: 'queued',
    });
    // advances the poll cursor to `now`
    expect(tx.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { lastAlertSentAt: NOW },
    });
    // audited (G4) — one alert event per email queued
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        actor: 'worker:saved-search-alerts-instant',
        action: 'saved_search.alerted',
        entity: 'saved_search',
        entityId: 's1',
      }),
    });
  });

  it('advances the cursor WITHOUT emailing when there are no new matches', async () => {
    tx.property.findMany.mockResolvedValue([]);

    const outcome = await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch(),
      now: NOW,
    });

    expect(outcome).toBe('advanced');
    expect(tx.notificationLog.create).not.toHaveBeenCalled();
    expect(tx.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { lastAlertSentAt: NOW },
    });
    // no email => no alert audit row
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('re-polling the same window sends no duplicate email (cursor idempotency, FR-U-4)', async () => {
    // First poll: one fresh property, cursor at 07:00 -> matches -> emailed, cursor -> NOW.
    tx.property.findMany.mockResolvedValueOnce([property({ id: 'p1' })]);
    const first = await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch({ lastAlertSentAt: new Date('2026-06-28T07:00:00Z') }),
      now: NOW,
    });
    expect(first).toBe('emailed');

    // Second poll with the advanced cursor: the strict publishedAt > cursor window is
    // now empty (the property is no longer NEW), so the read returns nothing and no
    // second email is queued.
    tx.property.findMany.mockResolvedValueOnce([]);
    const second = await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch({ lastAlertSentAt: NOW }),
      now: new Date('2026-06-28T07:10:00Z'),
    });
    expect(second).toBe('advanced');
    expect(tx.notificationLog.create).toHaveBeenCalledTimes(1); // still just the first email
  });

  it('threads the baseUrl into the alert payload and renders each match (POA + null-title)', async () => {
    tx.property.findMany.mockResolvedValue([
      property({ id: 'p1', price: null, title: null, displayAddress: '7 Oak Way', slug: 'oak' }),
    ]);

    const outcome = await processSavedSearchInstant({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: instantSearch(),
      now: NOW,
      baseUrl: 'https://acme.test',
    });

    expect(outcome).toBe('emailed');
    const created = tx.notificationLog.create.mock.calls[0]![0].data as {
      payload: { baseUrl: string; count: number; properties: Array<Record<string, string>> };
    };
    expect(created.payload.baseUrl).toBe('https://acme.test');
    expect(created.payload.count).toBe(1);
    expect(created.payload.properties[0]).toEqual({
      title: '7 Oak Way',
      address: '7 Oak Way, M20 2AB',
      price: 'POA',
      href: '/properties/oak',
    });
  });
});

describe('processTenantInstantAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('processes every instant search for the tenant and tallies the outcomes', async () => {
    const tx = makeTx();
    tx.savedSearch.findMany.mockResolvedValue([
      {
        id: 's1',
        userId: 'u1',
        name: 'A',
        filters: { page: 1 },
        lastAlertSentAt: null,
        user: { email: 'a@example.com' },
      },
      {
        id: 's2',
        userId: 'u2',
        name: 'B',
        filters: { page: 1 },
        lastAlertSentAt: null,
        user: { email: 'b@example.com' },
      },
    ]);
    // s1 sees a match; s2 sees none
    tx.property.findMany.mockResolvedValueOnce([property({ id: 'p1' })]).mockResolvedValueOnce([]);

    const counts = await processTenantInstantAlerts({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      now: NOW,
      baseUrl: 'https://acme.test',
    });

    expect(counts).toEqual({ searches: 2, emailed: 1, advanced: 1 });
    expect(tx.notificationLog.create).toHaveBeenCalledTimes(1);
    expect(tx.savedSearch.update).toHaveBeenCalledTimes(2);
  });
});

describe('runInstantAlertsTick', () => {
  it('runs every active tenant inside its own tenant scope', async () => {
    const txA = makeTx();
    const txB = makeTx();
    txA.savedSearch.findMany.mockResolvedValue([
      {
        id: 's1',
        userId: 'u1',
        name: 'A',
        filters: { page: 1 },
        lastAlertSentAt: null,
        user: { email: 'a@example.com' },
      },
    ]);
    txA.property.findMany.mockResolvedValue([property({ id: 'p1' })]);
    txB.savedSearch.findMany.mockResolvedValue([]);

    const runners: Record<string, Tx> = { 'tenant-a': txA, 'tenant-b': txB };

    const result = await runInstantAlertsTick({
      now: NOW,
      baseUrl: 'https://acme.test',
      listActiveTenants: async () => [{ id: 'tenant-a' }, { id: 'tenant-b' }],
      runTenantFor: (tenantId) => runnerFor(runners[tenantId]!),
    });

    expect(result).toEqual({ tenants: 2, searches: 1, emailed: 1, advanced: 0 });
    expect(txA.notificationLog.create).toHaveBeenCalledTimes(1);
    expect(txB.notificationLog.create).not.toHaveBeenCalled();
  });

  it('does not cross tenants: a property in tenant A never alerts a search in tenant B', async () => {
    // Tenant A owns the matching property but has no instant saved search.
    const txA = makeTx();
    txA.savedSearch.findMany.mockResolvedValue([]);
    txA.property.findMany.mockResolvedValue([property({ id: 'p1' })]);

    // Tenant B owns the instant saved search but (under its own RLS scope) sees NO
    // properties — tenant A's property is invisible to it.
    const txB = makeTx();
    txB.savedSearch.findMany.mockResolvedValue([
      {
        id: 's-b',
        userId: 'u-b',
        name: 'B search',
        filters: { page: 1 },
        lastAlertSentAt: null,
        user: { email: 'b@example.com' },
      },
    ]);
    txB.property.findMany.mockResolvedValue([]);

    const runners: Record<string, Tx> = { 'tenant-a': txA, 'tenant-b': txB };

    const result = await runInstantAlertsTick({
      now: NOW,
      listActiveTenants: async () => [{ id: 'tenant-a' }, { id: 'tenant-b' }],
      runTenantFor: (tenantId) => runnerFor(runners[tenantId]!),
    });

    // B's search advances its cursor but emails nothing (no properties in its scope).
    expect(result).toEqual({ tenants: 2, searches: 1, emailed: 0, advanced: 1 });
    expect(txA.notificationLog.create).not.toHaveBeenCalled();
    expect(txB.notificationLog.create).not.toHaveBeenCalled();
  });

  it('omits the baseUrl from the payload when none is configured (relative links)', async () => {
    const tx = makeTx();
    tx.savedSearch.findMany.mockResolvedValue([
      {
        id: 's1',
        userId: 'u1',
        name: 'A',
        filters: { page: 1 },
        lastAlertSentAt: null,
        user: { email: 'a@example.com' },
      },
    ]);
    tx.property.findMany.mockResolvedValue([property({ id: 'p1' })]);

    await runInstantAlertsTick({
      now: NOW,
      listActiveTenants: async () => [{ id: 'tenant-a' }],
      runTenantFor: () => runnerFor(tx),
    });

    const created = tx.notificationLog.create.mock.calls[0]![0].data as {
      payload: Record<string, unknown>;
    };
    expect(created.payload).not.toHaveProperty('baseUrl');
  });
});
