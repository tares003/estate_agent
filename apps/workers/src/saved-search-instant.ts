import { audit, notify } from '@estate/db';
import type { AlertFrequency, PropertySearch } from '@estate/validators';

import { findNewMatches, type CandidateProperty } from './saved-search-match.js';

// EPIC-U + EPIC-T FR-T-7/8 / FR-U — the INSTANT branch of saved-search alerts
// (worker catalogue row `saved_search_alerts_instant`). Where the digest worker
// fires on a daily/weekly cron, this one runs on a short poll (index.ts wires a
// ~1-minute repeatable job). Each tick, for every saved search on the `instant`
// cadence, it reads the properties published since that search's cursor
// (`lastAlertSentAt`), matches them with the SAME pure predicate the catalogue and
// digest use, and — when there are new matches — queues ONE alert email and
// advances the cursor. No web-app change is needed: there is no enqueue-from-web
// BullMQ path, so the "instant" trigger is a fast poll of `publishedAt`, not an
// event pushed from the publish Server Action. The 1-minute latency is the V1
// definition of "instant" (the timezone refinement FR-U-9 is a later slice).
//
// Idempotency (FR-U-4): advancing `lastAlertSentAt` to `now` plus the strict
// `publishedAt > cursor` window means a replayed poll finds nothing new and
// re-sends nothing. Tenancy mirrors the digest/email/image/sms ticks: the tick
// lists the (un-RLS'd) tenant registry and runs EACH tenant inside its own RLS
// scope, so a property in tenant A can never alert a saved search in tenant B.
//
// The instant alert REUSES the digest notification event (`saved_search.digest`)
// so the existing digest email template renders it verbatim — no new template.
//
// NOTE (CLAUDE.md §8): the digest/alert email copy is AI-drafted and must be
// reviewed by a human before shipping to real recipients (notification-templates.ts).

/** The alert cadence this worker serves (the non-digest, poll-driven cadence). */
export const INSTANT_CADENCE = 'instant' satisfies AlertFrequency;

/** The notification event the alert is queued under — reuses the digest template. */
const INSTANT_ALERT_EVENT = 'saved_search.digest';

/** The audit actor for the instant-alert worker (matches the worker/queue name). */
const INSTANT_ALERT_ACTOR = 'worker:saved-search-alerts-instant';

/** A saved search on the instant cadence, joined to its owner's email. */
export interface InstantSavedSearch {
  id: string;
  userId: string;
  name: string;
  /** The owning customer's email — the alert recipient. */
  recipient: string;
  /** The persisted catalogue filter object (the /properties URL filter shape). */
  filters: PropertySearch;
  /** The previous alert's timestamp (the poll cursor); null until the first alert. */
  lastAlertSentAt: Date | null;
}

/** The raw row the read model selects (filters opaque, user nested). */
interface InstantSavedSearchRecord {
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
 * The structural client the instant-alert job needs (a tenant-scoped Prisma tx
 * satisfies it). Reads the instant saved searches + the candidate properties;
 * writes the queued alert (notificationLog), the advanced cursor (savedSearch.update)
 * and the audit row — all camelCase Prisma model fields. Identical to the digest
 * client so the two workers share the same fake in tests.
 */
export interface SavedSearchInstantClient {
  savedSearch: {
    findMany(args: {
      where?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<InstantSavedSearchRecord[]>;
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
export type SavedSearchInstantTenantRunner = <T>(
  fn: (tx: SavedSearchInstantClient) => Promise<T>,
) => Promise<T>;

/** Narrow the opaque stored `filters` JSON to a {@link PropertySearch}. */
function toFilters(value: unknown): PropertySearch {
  return (value ?? {}) as PropertySearch;
}

/**
 * The instant-cadence saved searches, joined to the owning user's email. Scoped to
 * the tenant by the surrounding RLS transaction; `alertFrequency = 'instant'` picks
 * exactly the poll-driven searches (off + daily + weekly excluded).
 */
export async function listInstantSavedSearches(
  tx: SavedSearchInstantClient,
): Promise<InstantSavedSearch[]> {
  const rows = await tx.savedSearch.findMany({
    where: { alertFrequency: INSTANT_CADENCE },
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
 * The candidate properties for matching: published, non-deleted properties published
 * AFTER the saved search's cursor (only genuinely new listings are considered). A
 * null cursor (first poll) reads every published, non-deleted property. The matcher
 * re-applies the same base gate in-memory, so this query is a narrowing optimisation.
 */
export async function listCandidateProperties(
  tx: SavedSearchInstantClient,
  since: Date | null,
): Promise<CandidateProperty[]> {
  const publishedAt = since === null ? { not: null } : { gt: since };
  return tx.property.findMany({ where: { publishedAt, deletedAt: null } });
}

/**
 * The new matches for one instant saved search — the pure step. Reuses the shared
 * {@link findNewMatches} predicate (the in-memory twin of the catalogue `buildWhere`),
 * so an instant alert matches identically to the catalogue and the digest.
 */
export function processInstantMatches(
  search: InstantSavedSearch,
  candidates: CandidateProperty[],
): CandidateProperty[] {
  return findNewMatches(search.filters, candidates, search.lastAlertSentAt);
}

/** The outcome of processing one instant saved search. */
export type InstantOutcome = 'emailed' | 'advanced';

/** Format a price stored in pence as GBP (52500000 → "£525,000"); null → "POA". */
function formatPrice(pence: number | null): string {
  if (pence === null) return 'POA';
  const pounds = Math.round(pence / 100);
  return `£${new Intl.NumberFormat('en-GB').format(pounds)}`;
}

/** The per-property shape the alert template renders (same as the digest). */
export interface InstantAlertProperty {
  title: string;
  address: string;
  price: string;
  href: string;
}

/** Map a matched §J property to the alert's render shape. */
function toAlertProperty(property: CandidateProperty): InstantAlertProperty {
  return {
    title: property.title ?? property.displayAddress,
    address: `${property.displayAddress}, ${property.postcode}`,
    price: formatPrice(property.price),
    href: `/properties/${property.slug}`,
  };
}

/**
 * Process one instant saved search: read its new matches since the cursor, queue one
 * alert (or not), and advance the cursor. Always advances `lastAlertSentAt` to `now`
 * so the next poll's window starts here — whether or not an email was queued. This
 * cursor advance is what makes a replayed poll idempotent (FR-U-4).
 */
export async function processSavedSearchInstant(opts: {
  tenantId: string;
  runTenant: SavedSearchInstantTenantRunner;
  search: InstantSavedSearch;
  now: Date;
  baseUrl?: string;
}): Promise<InstantOutcome> {
  const { tenantId, runTenant, search, now } = opts;

  const candidates = await runTenant((tx) => listCandidateProperties(tx, search.lastAlertSentAt));
  const matches = processInstantMatches(search, candidates);

  if (matches.length === 0) {
    // No new matches — advance the cursor without emailing.
    await runTenant((tx) =>
      tx.savedSearch.update({ where: { id: search.id }, data: { lastAlertSentAt: now } }),
    );
    return 'advanced';
  }

  const payload = {
    searchName: search.name,
    count: matches.length,
    ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {}),
    properties: matches.map(toAlertProperty),
  };

  await runTenant(async (tx) => {
    await notify(tx, {
      tenantId,
      event: INSTANT_ALERT_EVENT,
      channel: 'email',
      recipient: search.recipient,
      payload,
    });
    await tx.savedSearch.update({ where: { id: search.id }, data: { lastAlertSentAt: now } });
    await audit(tx, {
      tenantId,
      actor: INSTANT_ALERT_ACTOR,
      action: 'saved_search.alerted',
      entity: 'saved_search',
      entityId: search.id,
      diff: { matches: matches.length },
    });
  });

  return 'emailed';
}

/** Per-tenant instant-alert outcome counts for one tick. */
export interface InstantCounts {
  searches: number;
  emailed: number;
  advanced: number;
}

/** Process every instant saved search for one tenant. */
export async function processTenantInstantAlerts(opts: {
  tenantId: string;
  runTenant: SavedSearchInstantTenantRunner;
  now: Date;
  baseUrl?: string;
}): Promise<InstantCounts> {
  const { tenantId, runTenant, now } = opts;
  const counts: InstantCounts = { searches: 0, emailed: 0, advanced: 0 };

  const searches = await runTenant((tx) => listInstantSavedSearches(tx));
  counts.searches = searches.length;

  for (const search of searches) {
    const outcome = await processSavedSearchInstant({
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

/** One poll tick's totals across every active tenant. */
export interface InstantTickCounts extends InstantCounts {
  tenants: number;
}

/**
 * Run one instant-alert poll across every active tenant, each inside its own tenant
 * scope. The cron/poll entrypoint (index.ts) calls this every ~minute; the per-tenant
 * fan-out is serial (FR-U-4 idempotency over speed for V1 volumes). A per-tenant
 * failure is surfaced by the caller's Worker `failed` handler; each tenant's cursor
 * only advances when its own transaction commits.
 */
export async function runInstantAlertsTick(deps: {
  now: Date;
  listActiveTenants(): Promise<Array<{ id: string }>>;
  runTenantFor(tenantId: string): SavedSearchInstantTenantRunner;
  baseUrl?: string;
}): Promise<InstantTickCounts> {
  const tenants = await deps.listActiveTenants();
  const totals: InstantTickCounts = {
    tenants: tenants.length,
    searches: 0,
    emailed: 0,
    advanced: 0,
  };

  for (const tenant of tenants) {
    const counts = await processTenantInstantAlerts({
      tenantId: tenant.id,
      runTenant: deps.runTenantFor(tenant.id),
      now: deps.now,
      ...(deps.baseUrl !== undefined ? { baseUrl: deps.baseUrl } : {}),
    });
    totals.searches += counts.searches;
    totals.emailed += counts.emailed;
    totals.advanced += counts.advanced;
  }

  return totals;
}
