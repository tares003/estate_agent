/**
 * Append-only audit-trail write-helper. Every state-changing action persists one
 * `audit_logs` row through this helper — it is the implementation the G4
 * audit-log-coverage guard's `audit(...)` call resolves to (CLAUDE.md §2).
 *
 * The helper takes an injected client typed as a minimal structural interface
 * ({@link AuditWriter}) so callers and tests need not depend on the full
 * `PrismaClient` or its generated input types; a real `PrismaClient` satisfies it.
 */

/** Input for {@link audit}. `action` is a `subject.verb` event name (e.g. `property.published`). */
export interface AuditInput {
  /** Owning tenant; null for operator-level actions that span tenants. */
  tenantId?: string | null;
  /** Who performed the action (e.g. `agent:albert-aardvark`, `operator:olive-okapi`). */
  actor: string;
  /** The `subject.verb` event name (e.g. `property.published`). */
  action: string;
  /** The canonical entity noun the action targets (e.g. `property`). */
  entity: string;
  /** The affected entity's identifier, when applicable. */
  entityId?: string | null;
  /** Structured before/after change set, when applicable. */
  diff?: unknown;
  /** Originating IP address, when known. */
  ip?: string | null;
  /** Originating user-agent string, when known. */
  userAgent?: string | null;
}

/** Minimal write surface {@link audit} needs (a `PrismaClient` satisfies it). */
export interface AuditWriter {
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Persists one `audit_logs` row. Optional fields default to `null` so the row is
 * fully specified. Field names are the camelCase Prisma model fields; the
 * `entityId -> entity_id` / `userAgent -> user_agent` column mapping is handled by
 * the schema's `@map` directives.
 */
export async function audit(client: AuditWriter, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      actor: input.actor,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      diff: input.diff ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
