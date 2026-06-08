/**
 * Outbound-notification write-helper (master spec §H.13). Persists one
 * `notification_logs` row with status `queued`; the actual email / SMS dispatch is
 * performed later by @estate/email reading the queued rows. This helper only
 * records intent — it never sends.
 *
 * The helper takes an injected client typed as a minimal structural interface
 * ({@link NotificationWriter}) so callers and tests need not depend on the full
 * `PrismaClient` or its generated input types; a real `PrismaClient` satisfies it.
 */

/** Delivery channel for a queued notification. */
export type NotifyChannel = 'email' | 'sms' | 'in_app';

/** Input for {@link notify}. `event` is a `subject.verb` event name (e.g. `enquiry.received`). */
export interface NotifyInput {
  /** Owning tenant; null when the notification is operator-level. */
  tenantId?: string | null;
  /** The `subject.verb` event name that triggered the notification. */
  event: string;
  /** The channel the notification is queued for. */
  channel: NotifyChannel;
  /** The destination (email address, E.164 phone number, or in-app actor handle). */
  recipient: string;
  /** Structured template data for the eventual render, when applicable. */
  payload?: unknown;
}

/** Minimal write surface {@link notify} needs (a `PrismaClient` satisfies it). */
export interface NotificationWriter {
  notificationLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Persists one `notification_logs` row with status `queued`. Optional fields
 * default to `null` so the row is fully specified. Field names are the camelCase
 * Prisma model fields.
 */
export async function notify(client: NotificationWriter, input: NotifyInput): Promise<void> {
  await client.notificationLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      event: input.event,
      channel: input.channel,
      recipient: input.recipient,
      status: 'queued',
      payload: input.payload ?? null,
    },
  });
}
