import { z } from 'zod';
import { email, ukPhone } from './fields.js';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the admin-editable repair notification routing configuration. Master spec §G.7
// routes every new ticket to the property manager + branch repairs queue by email
// (`repair_new_internal`) and an emergency ticket additionally to the on-call
// manager by SMS (`repair_emergency_internal`); this schema validates the
// per-tenant recipients those channels deliver to. Either channel may be
// unconfigured (null) — the submit action skips a channel with no recipient.
// Captures NO personal data of the public (staff routing configuration), so it
// carries no GDPR-consent affirmation. The full §H.13 notification-rules matrix,
// the on-call rota and the Slack/Teams team-messaging channel are deferred to
// EPIC-H.

export const repairNotificationConfigSchema = z.object({
  /** Internal email alerted on every submission (§G.7 "Property manager + branch repairs queue"). */
  repairsEmail: email.nullable(),
  /** On-call manager's phone, paged by SMS on emergency submissions (§G.7). */
  onCallPhone: ukPhone.nullable(),
});

/** A validated per-tenant repair notification routing configuration. */
export type RepairNotificationConfigInput = z.infer<typeof repairNotificationConfigSchema>;
