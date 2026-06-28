import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CandidateProperty } from './saved-search-match.js';
import {
  CADENCES,
  listCandidateProperties,
  listDueSavedSearches,
  processSavedSearchDigest,
  processTenantSavedSearchDigests,
  runSavedSearchDigestTick,
  type DueSavedSearch,
  type SavedSearchDigestClient,
} from './saved-search-digest.js';

const TENANT = '00000000-0000-0000-0000-000000000001';
const NOW = new Date('2026-06-28T07:00:00Z');

function dueSearch(over: Partial<DueSavedSearch> = {}): DueSavedSearch {
  return {
    id: 's1',
    userId: 'u1',
    name: 'Didsbury 2-beds',
    recipient: 'tess@example.com',
    filters: { unit: 'mi', sort: 'newest', page: 1 } as DueSavedSearch['filters'],
    lastAlertSentAt: new Date('2026-06-27T07:00:00Z'),
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
    publishedAt: new Date('2026-06-28T06:00:00Z'),
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
  return async <T>(fn: (c: SavedSearchDigestClient) => Promise<T>): Promise<T> =>
    fn(tx as unknown as SavedSearchDigestClient);
}

describe('CADENCES', () => {
  it('covers exactly the digest cadences (daily + weekly; off + instant are not digest)', () => {
    expect(CADENCES).toEqual(['daily', 'weekly']);
  });
});

describe('listDueSavedSearches', () => {
  it('lists saved searches for the cadence, joined to the owning user email', async () => {
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

    const rows = await listDueSavedSearches(tx as unknown as SavedSearchDigestClient, 'daily');

    expect(tx.savedSearch.findMany).toHaveBeenCalledWith({
      where: { alertFrequency: 'daily' },
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

describe('listCandidateProperties', () => {
  it('reads published, non-deleted properties published after the cutoff', async () => {
    const tx = makeTx();
    const since = new Date('2026-06-27T07:00:00Z');
    await listCandidateProperties(tx as unknown as SavedSearchDigestClient, since);
    expect(tx.property.findMany).toHaveBeenCalledWith({
      where: { publishedAt: { gt: since }, deletedAt: null },
    });
  });

  it('reads all published, non-deleted properties when the cutoff is null', async () => {
    const tx = makeTx();
    await listCandidateProperties(tx as unknown as SavedSearchDigestClient, null);
    expect(tx.property.findMany).toHaveBeenCalledWith({
      where: { publishedAt: { not: null }, deletedAt: null },
    });
  });
});

describe('processSavedSearchDigest', () => {
  let tx: Tx;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
  });

  it('queues ONE digest email and advances the cutoff when there are new matches', async () => {
    tx.property.findMany.mockResolvedValue([property({ id: 'p1' }), property({ id: 'p2' })]);

    const outcome = await processSavedSearchDigest({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: dueSearch(),
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
    // advances the cutoff to `now`
    expect(tx.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { lastAlertSentAt: NOW },
    });
    // audited (G4)
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        action: 'saved_search.alerted',
        entity: 'saved_search',
        entityId: 's1',
      }),
    });
  });

  it('advances the cutoff WITHOUT emailing when there are no new matches', async () => {
    tx.property.findMany.mockResolvedValue([]);

    const outcome = await processSavedSearchDigest({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: dueSearch(),
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

  it('only counts matches NEW since the search cutoff, not every current match', async () => {
    // candidate query is scoped by the cutoff, so an old match never reaches matching
    tx.property.findMany.mockResolvedValue([
      property({ id: 'fresh', publishedAt: new Date('2026-06-28T06:30:00Z') }),
    ]);

    const outcome = await processSavedSearchDigest({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: dueSearch({ lastAlertSentAt: new Date('2026-06-27T07:00:00Z') }),
      now: NOW,
    });

    expect(outcome).toBe('emailed');
    expect(tx.property.findMany).toHaveBeenCalledWith({
      where: { publishedAt: { gt: new Date('2026-06-27T07:00:00Z') }, deletedAt: null },
    });
  });

  it('does not email when the only candidate fails the saved search filters', async () => {
    tx.property.findMany.mockResolvedValue([property({ id: 'p1', bedrooms: 1 })]);

    const outcome = await processSavedSearchDigest({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: dueSearch({
        filters: {
          unit: 'mi',
          sort: 'newest',
          page: 1,
          bedroomsMin: 3,
        } as DueSavedSearch['filters'],
      }),
      now: NOW,
    });

    expect(outcome).toBe('advanced');
    expect(tx.notificationLog.create).not.toHaveBeenCalled();
    expect(tx.savedSearch.update).toHaveBeenCalled();
  });

  it('threads the baseUrl into the digest payload and renders each match (POA + null-title)', async () => {
    tx.property.findMany.mockResolvedValue([
      property({ id: 'p1', price: null, title: null, displayAddress: '7 Oak Way', slug: 'oak' }),
    ]);

    const outcome = await processSavedSearchDigest({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      search: dueSearch(),
      now: NOW,
      baseUrl: 'https://acme.test',
    });

    expect(outcome).toBe('emailed');
    const created = tx.notificationLog.create.mock.calls[0]![0].data as {
      payload: { baseUrl: string; count: number; properties: Array<Record<string, string>> };
    };
    expect(created.payload.baseUrl).toBe('https://acme.test');
    expect(created.payload.count).toBe(1);
    // null price → "POA"; null title falls back to the display address
    expect(created.payload.properties[0]).toEqual({
      title: '7 Oak Way',
      address: '7 Oak Way, M20 2AB',
      price: 'POA',
      href: '/properties/oak',
    });
  });

  it('tolerates a null/absent stored filters object (matches every new property)', async () => {
    tx.savedSearch.findMany.mockResolvedValue([
      {
        id: 's9',
        userId: 'u9',
        name: 'Everything',
        filters: null,
        lastAlertSentAt: null,
        user: { email: 'ed@example.com' },
      },
    ]);
    tx.property.findMany.mockResolvedValue([property({ id: 'p1' })]);

    const counts = await processTenantSavedSearchDigests({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      cadence: 'daily',
      now: NOW,
    });

    expect(counts).toEqual({ searches: 1, emailed: 1, advanced: 0 });
  });
});

describe('processTenantSavedSearchDigests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('processes every due search for the cadence and tallies the outcomes', async () => {
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
    // s1 sees a match; s2 sees none (no published rows after its own cutoff)
    tx.property.findMany.mockResolvedValueOnce([property({ id: 'p1' })]).mockResolvedValueOnce([]);

    const counts = await processTenantSavedSearchDigests({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      cadence: 'daily',
      now: NOW,
      baseUrl: 'https://acme.test',
    });

    expect(counts).toEqual({ searches: 2, emailed: 1, advanced: 1 });
    expect(tx.notificationLog.create).toHaveBeenCalledTimes(1);
    expect(tx.savedSearch.update).toHaveBeenCalledTimes(2);
    // the baseUrl reaches the queued digest payload
    const created = tx.notificationLog.create.mock.calls[0]![0].data as {
      payload: { baseUrl: string };
    };
    expect(created.payload.baseUrl).toBe('https://acme.test');
  });
});

describe('runSavedSearchDigestTick', () => {
  it('runs the cadence for every active tenant inside its own tenant scope', async () => {
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

    const result = await runSavedSearchDigestTick({
      cadence: 'daily',
      now: NOW,
      baseUrl: 'https://acme.test',
      listActiveTenants: async () => [{ id: 'tenant-a' }, { id: 'tenant-b' }],
      runTenantFor: (tenantId) => runnerFor(runners[tenantId]!),
    });

    expect(result).toEqual({ tenants: 2, searches: 1, emailed: 1, advanced: 0 });
    expect(txA.notificationLog.create).toHaveBeenCalledTimes(1);
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

    await runSavedSearchDigestTick({
      cadence: 'weekly',
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
