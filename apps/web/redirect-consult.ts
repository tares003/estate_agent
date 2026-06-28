import { withTenant } from '@estate/db';

import {
  findActiveRedirect,
  type ActiveRedirect,
  type RedirectReader,
} from './app/(app)/lib/redirects.js';

// EPIC-O FR-O-11 — the proxy's redirect consult. Looks up an exact-path managed
// redirect rule for the resolved tenant (inside the tenant RLS scope) and, when one
// matches, hands the proxy the HTTP status + destination to emit. A best-effort hit
// counter bump is fired afterwards.
//
// FAIL-OPEN by contract: every function here swallows its errors and resolves to a
// neutral value (null / no-op). A redirect-lookup or hit-bump failure must NEVER break
// the request — the caller falls through to normal tenant pass-through.

/** The minimal db surface the consult needs (a real PrismaClient satisfies it). */
export interface RedirectDb {
  $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}

/** The hit-bump write surface (a real PrismaClient tx satisfies it). */
export interface RedirectHitWriter {
  redirect: {
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** A matched rule plus the HTTP status the proxy should emit. */
export interface RedirectMatch {
  id: string;
  destinationPath: string;
  /** 301 / 302 / 307 for a location redirect; 410 for a `gone` rule. */
  status: number;
}

/** Map a stored RedirectType value to its HTTP status code. */
export function redirectStatus(type: string): number {
  switch (type) {
    case 'r301':
      return 301;
    case 'r302':
      return 302;
    case 'r307':
      return 307;
    case 'gone':
      return 410;
    default:
      return 301;
  }
}

/**
 * Resolve the active redirect for `pathname` within `tenantId`, or null when there
 * is none (or on ANY error — fail-open). Runs the lookup inside the tenant RLS scope.
 */
export async function consultRedirect(
  db: RedirectDb,
  tenantId: string,
  pathname: string,
): Promise<RedirectMatch | null> {
  try {
    const match: ActiveRedirect | null = await withTenant(
      db as unknown as Parameters<typeof withTenant>[0],
      tenantId,
      (tx) => findActiveRedirect(tx as unknown as RedirectReader, pathname),
    );
    if (!match) return null;
    return {
      id: match.id,
      destinationPath: match.destinationPath,
      status: redirectStatus(match.type),
    };
  } catch {
    // Fail-open: never let a redirect-lookup error break the request.
    return null;
  }
}

/**
 * Best-effort: increment the rule's hit counter + stamp `lastHitAt`. Fire-and-forget;
 * any failure is swallowed (the redirect itself has already been decided, so a failed
 * counter bump must not affect the response). Runs inside the tenant RLS scope.
 */
export async function bumpRedirectHit(
  db: RedirectDb,
  tenantId: string,
  redirectId: string,
): Promise<void> {
  try {
    await withTenant(db as unknown as Parameters<typeof withTenant>[0], tenantId, async (tx) => {
      const writer = tx as unknown as RedirectHitWriter;
      await writer.redirect.update({
        where: { id: redirectId },
        data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
      });
    });
  } catch {
    // Fail-open: a failed hit bump never affects the response.
  }
}
