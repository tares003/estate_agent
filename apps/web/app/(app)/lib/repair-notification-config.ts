// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the repair notification routing read model. Returns the tenant's configured
// internal recipients (§G.7: the property-manager / branch-repairs-queue email +
// the on-call manager's phone), or nulls when nothing is configured yet. Tenant
// isolation is applied by the caller via withTenant (RLS); the structural reader
// keeps this DB-free for unit tests — a Prisma tx satisfies it.

/** The tenant's configured internal repair-notification recipients. */
export interface RepairNotificationRecipients {
  /** Internal email alerted on every submission (§G.7), or null when unset. */
  repairsEmail: string | null;
  /** On-call manager's phone for emergency SMS (§G.7), or null when unset. */
  onCallPhone: string | null;
}

/** Minimal read surface the loader needs (a Prisma tx satisfies it). */
export interface RepairNotificationConfigReader {
  repairNotificationConfig: {
    findFirst(args?: {
      select?: Record<string, unknown>;
    }): Promise<{ repairsEmail: string | null; onCallPhone: string | null } | null>;
  };
}

/**
 * Load the tenant's repair notification routing (FR-G-3), with both channels
 * null when no row exists yet. The caller scopes the read to the tenant
 * (withTenant / RLS).
 */
export async function loadRepairNotificationConfig(
  reader: RepairNotificationConfigReader,
): Promise<RepairNotificationRecipients> {
  const row = await reader.repairNotificationConfig.findFirst({
    select: { repairsEmail: true, onCallPhone: true },
  });
  return {
    repairsEmail: row?.repairsEmail ?? null,
    onCallPhone: row?.onCallPhone ?? null,
  };
}
