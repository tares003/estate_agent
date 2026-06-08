/**
 * GDPR consent write-helper. Every personal-data form submission persists one
 * `consent_logs` row through this helper — it is the implementation the G5
 * compliance guard's `recordConsent(...)` call resolves to (CLAUDE.md §2).
 *
 * The helper takes an injected client typed as a minimal structural interface
 * ({@link ConsentWriter}) so callers and tests need not depend on the full
 * `PrismaClient` or its generated input types; a real `PrismaClient` satisfies it.
 */

/** Input for {@link recordConsent}. */
export interface ConsentInput {
  /** Owning tenant; null when the consent is captured outside a tenant context. */
  tenantId?: string | null;
  /** The form / context the consent was captured at (e.g. `enquiry_form`). */
  scope: string;
  /** The data subject the consent belongs to (e.g. their email address). */
  subject: string;
  /** The exact affirmation text the subject agreed to, captured verbatim. */
  consentText: string;
  /** Originating IP address, when known. */
  ipAddress?: string | null;
}

/** Minimal write surface {@link recordConsent} needs (a `PrismaClient` satisfies it). */
export interface ConsentWriter {
  consentLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Persists one `consent_logs` row. Optional fields default to `null` so the row is
 * fully specified. Field names are the camelCase Prisma model fields; the
 * `consentText -> consent_text` / `ipAddress -> ip_address` column mapping is
 * handled by the schema's `@map` directives.
 */
export async function recordConsent(client: ConsentWriter, input: ConsentInput): Promise<void> {
  await client.consentLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      scope: input.scope,
      subject: input.subject,
      consentText: input.consentText,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
