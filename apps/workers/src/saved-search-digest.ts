import { audit, notify } from '@estate/db';
import type { AlertFrequency, PropertySearch } from '@estate/validators';

import { findNewMatches, type CandidateProperty } from './saved-search-match.js';

// EPIC-U + EPIC-T FR-T-7/8 — the saved-search alert digest job (worker catalogue
// rows `saved_search_alerts_daily` / `_weekly`). For each saved search due on a
// cadence, find the NEW property matches published since its last alert; if any,
// queue ONE digest email via notify() (tenant-scoped) and advance the cutoff; if
// none, advance the cutoff WITHOUT emailing (acceptance: an alert is emailed only
// when there are new matches since the previous alert — FR-T's daily-digest rule).
//
// Tenancy mirrors the email/image/sms ticks: the tick lists the (un-RLS'd) tenant
// registry and runs EACH tenant inside its own RLS scope (the same SET LOCAL
// extension apps/web uses). Idempotency (FR-U-4): advancing `lastAlertSentAt` to
// `now` and the strict `publishedAt > cutoff` window mean a replayed run finds
// nothing new and re-sends nothing. The heavy lifting (matching + read shapes)
// lives in the pure layer + structural readers, so the whole job is unit-testable
// without Redis or a live DB.
//
// NOTE (CLAUDE.md §8): the digest email copy is AI-drafted and must be reviewed by
// a human before shipping to real recipients (see notification-templates.ts).

/** The digest cadences this job serves (off + instant are NOT digest cadences). */
export const CADENCES = ['daily', 'weekly'] as const;

/** A digest cadence — the subset of {@link AlertFrequency} this worker handles. */
export type DigestCadence = (typeof CADENCES)[number] & AlertFrequency;

/** A saved search due for a digest, joined to its owner's email. */
export interface DueSavedSearch {
  id: string;
  userId: string;
  name: string;
  /** The owning customer's email — the digest recipient. */
  recipient: string;
  /** The persisted catalogue filter object (the /properties URL filter shape). */
  filters: PropertySearch;
  /** The previous alert's timestamp; null until the first alert fires. */
  lastAlertSentAt: Date | null;
}

/** The raw row the read model selects (filters opaque, user nested). */
interface DueSavedSearchRecord {
  id: string;
  userId: string;
  name: string;
  filters: unknown;
  lastAlertSentAt: Date | null;
  user: { email: string };
}

/** The §J Property columns the candidate read selects. */
type CandidateRecord = CandidateProperty;

/**
 * The structural client the digest job needs (a tenant-scoped Prisma tx satisfies
 * it). Reads the due saved searches + the candidate properties; writes the queued
 * digest (notificationLog), the advanced cutoff (savedSearch.update) and the audit
 * row — all camelCase Prisma model fields.
 */
export interface SavedSearchDigestClient {
  savedSearch: {
    findMany(args: {
      where?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<DueSavedSearchRecord[]>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  property: {
    findMany(args: { where?: Record<string, unknown> }): Promise<CandidateRecord[]>;
  };
  notificationLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** Run `fn` inside the tenant's RLS scope (bound to one tenant by the caller). */
export type SavedSearchTenantRunner = <T>(
  fn: (tx: SavedSearchDigestClient) => Promise<T>,
) => Promise<T>;

/** Narrow the opaque stored `filters` JSON to a {@link PropertySearch}. */
function toFilters(value: unknown): PropertySearch {
  return (value ?? {}) as PropertySearch;
}

/**
 * The saved searches due on a cadence, joined to the owning user's email. Scoped to
 * the tenant by the surrounding RLS transaction; `alertFrequency = <cadence>` picks
 * exactly the daily-or-weekly searches this run delivers (off + instant excluded).
 */
export async function listDueSavedSearches(
  tx: SavedSearchDigestClient,
  cadence: DigestCadence,
): Promise<DueSavedSearch[]> {
  const rows = await tx.savedSearch.findMany({
    where: { alertFrequency: cadence },
    select: {
      id: true,
      userId: true,
      name: true,
      filters: true,
      lastAlertSentAt: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    recipient: row.user.email,
    filters: toFilters(row.filters),
    lastAlertSentAt: row.lastAlertSentAt,
  }));
}

/**
 * The candidate properties for matching: published, non-deleted properties
 * published AFTER the saved search's previous-alert cutoff (so only genuinely new
 * listings are considered). A null cutoff (first run) reads every published,
 * non-deleted property. The matcher re-applies the same base gate in-memory, so
 * this query is a narrowing optimisation, not the source of truth.
 */
export async function listCandidateProperties(
  tx: SavedSearchDigestClient,
  since: Date | null,
): Promise<CandidateProperty[]> {
  const publishedAt = since === null ? { not: null } : { gt: since };
  return tx.property.findMany({ where: { publishedAt, deletedAt: null } });
}

/** The outcome of processing one saved search. */
export type DigestOutcome = 'emailed' | 'advanced';

/** Format a price stored in pence as GBP (52500000 → "£525,000"); null → "POA". */
function formatPrice(pence: number | null): string {
  if (pence === null) return 'POA';
  const pounds = Math.round(pence / 100);
  return `£${new Intl.NumberFormat('en-GB').format(pounds)}`;
}

/** The per-property shape the digest template renders. */
export interface DigestProperty {
  title: string;
  address: string;
  price: string;
  href: string;
}

/** Map a matched §J property to the digest's render shape. */
function toDigestProperty(property: CandidateProperty): DigestProperty {
  return {
    title: property.title ?? property.displayAddress,
    address: `${property.displayAddress}, ${property.postcode}`,
    price: formatPrice(property.price),
    href: `/properties/${property.slug}`,
  };
}

/**
 * Process one due saved search: find its new matches, queue one digest (or not),
 * and advance its cutoff. Always advances `lastAlertSentAt` to `now` so the next
 * run's window starts here — whether or not an email was queued.
 */
export async function processSavedSearchDigest(opts: {
  tenantId: string;
  runTenant: SavedSearchTenantRunner;
  search: DueSavedSearch;
  now: Date;
  baseUrl?: string;
}): Promise<DigestOutcome> {
  const { tenantId, runTenant, search, now } = opts;

  const candidates = await runTenant((tx) => listCandidateProperties(tx, search.lastAlertSentAt));
  const matches = findNewMatches(search.filters, candidates, search.lastAlertSentAt);

  if (matches.length === 0) {
    // No new matches — advance the cutoff without emailing (acceptance rule).
    await runTenant((tx) =>
      tx.savedSearch.update({ where: { id: search.id }, data: { lastAlertSentAt: now } }),
    );
    return 'advanced';
  }

  const payload = {
    searchName: search.name,
    count: matches.length,
    ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {}),
    properties: matches.map(toDigestProperty),
  };

  await runTenant(async (tx) => {
    await notify(tx, {
      tenantId,
      event: 'saved_search.digest',
      channel: 'email',
      recipient: search.recipient,
      payload,
    });
    await tx.savedSearch.update({ where: { id: search.id }, data: { lastAlertSentAt: now } });
    await audit(tx, {
      tenantId,
      actor: 'worker:saved-search-alerts',
      action: 'saved_search.alerted',
      entity: 'saved_search',
      entityId: search.id,
      diff: { matches: matches.length },
    });
  });

  return 'emailed';
}

/** Per-tenant digest outcome counts for one cadence. */
export interface DigestCounts {
  searches: number;
  emailed: number;
  advanced: number;
}

/** Process every due saved search for one tenant + cadence. */
export async function processTenantSavedSearchDigests(opts: {
  tenantId: string;
  runTenant: SavedSearchTenantRunner;
  cadence: DigestCadence;
  now: Date;
  baseUrl?: string;
}): Promise<DigestCounts> {
  const { tenantId, runTenant, cadence, now } = opts;
  const counts: DigestCounts = { searches: 0, emailed: 0, advanced: 0 };

  const searches = await runTenant((tx) => listDueSavedSearches(tx, cadence));
  counts.searches = searches.length;

  for (const search of searches) {
    const outcome = await processSavedSearchDigest({
      tenantId,
      runTenant,
      search,
      now,
      ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {}),
    });
    if (outcome === 'emailed') counts.emailed += 1;
    else counts.advanced += 1;
  }

  return counts;
}

/** One tick's totals across every active tenant. */
export interface DigestTickCounts extends DigestCounts {
  tenants: number;
}

/**
 * Run one cadence's digest across every active tenant, each inside its own tenant
 * scope. The cron entrypoint (index.ts) calls this for `daily` and `weekly`; the
 * per-tenant fan-out is serial (FR-U-4 idempotency over speed for V1 volumes).
 */
export async function runSavedSearchDigestTick(deps: {
  cadence: DigestCadence;
  now: Date;
  listActiveTenants(): Promise<Array<{ id: string }>>;
  runTenantFor(tenantId: string): SavedSearchTenantRunner;
  baseUrl?: string;
}): Promise<DigestTickCounts> {
  const tenants = await deps.listActiveTenants();
  const totals: DigestTickCounts = {
    tenants: tenants.length,
    searches: 0,
    emailed: 0,
    advanced: 0,
  };

  for (const tenant of tenants) {
    const counts = await processTenantSavedSearchDigests({
      tenantId: tenant.id,
      runTenant: deps.runTenantFor(tenant.id),
      cadence: deps.cadence,
      now: deps.now,
      ...(deps.baseUrl !== undefined ? { baseUrl: deps.baseUrl } : {}),
    });
    totals.searches += counts.searches;
    totals.emailed += counts.emailed;
    totals.advanced += counts.advanced;
  }

  return totals;
}
