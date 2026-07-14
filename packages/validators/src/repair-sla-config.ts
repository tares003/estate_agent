import { z } from 'zod';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// admin-editable repair SLA configuration. Master spec §G.4 gives each urgency an
// SLA target and marks it "(configurable)"; FR-G-9 requires the inbox's SLA-breach
// badge to change colour at "configurable thresholds". This schema validates the
// per-tenant values both.
//
// The shipped DEFAULT_REPAIR_SLA_CONFIG reproduces §G.4 (emergency 4h, urgent 24h,
// standard 48h acknowledgement, non-urgent 5 working days acknowledgement) and the
// FR-G-9 default bands (green ≤ 50%, amber 50–75%, red > 75%), so an unconfigured
// tenant behaves exactly as before this slice landed.
//
// Breach is NOT a configurable threshold: FR-G-9 fixes it at 100% of the target
// elapsed (that is what "breached" means), so the two editable thresholds are the
// due-soon and at-risk boundaries and both live strictly inside 1–99%.
//
// The urgency SET itself (RepairUrgency: emergency / urgent / standard / low)
// remains the committed Prisma enum — this schema configures the TARGETS for those
// urgencies, not the taxonomy's membership. See the model comment in schema.prisma.
//
// Captures NO personal data (staff configuration), so it carries no GDPR-consent
// affirmation.

/** Ceiling on an hours target — a year, so a typo can't disable the badge entirely. */
const MAX_TARGET_HOURS = 8_760;
/** Ceiling on a working-days target — roughly a working year. */
const MAX_TARGET_WORKING_DAYS = 260;

/** A whole, positive SLA target in hours. */
const targetHours = z.number().int().positive().max(MAX_TARGET_HOURS);

/** A badge threshold: a whole percentage of the target elapsed, strictly inside 0–100. */
const thresholdPercent = z.number().int().min(1).max(99);

export const repairSlaConfigSchema = z
  .object({
    /** §G.4 Emergency — "contractor on site < 4 hours". */
    emergencyTargetHours: targetHours,
    /** §G.4 Urgent — "contractor on site < 24 hours". */
    urgentTargetHours: targetHours,
    /** §G.4 Standard — "acknowledged < 48 hours". */
    standardTargetHours: targetHours,
    /** §G.4 Non-urgent — "acknowledged < 5 working days" (the `low` enum value). */
    lowTargetWorkingDays: z.number().int().positive().max(MAX_TARGET_WORKING_DAYS),
    /** FR-G-9 amber boundary — above this share of the target elapsed, the badge is "Due soon". */
    dueSoonThresholdPercent: thresholdPercent,
    /** FR-G-9 red boundary — above this share of the target elapsed, the badge is "At risk". */
    atRiskThresholdPercent: thresholdPercent,
  })
  .superRefine((config, ctx) => {
    // The bands must ascend: on-track ≤ due-soon < at-risk < breached (100%).
    if (config.atRiskThresholdPercent <= config.dueSoonThresholdPercent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['atRiskThresholdPercent'],
        message: 'The at-risk threshold must be higher than the due-soon threshold.',
      });
    }
  });

/** A validated per-tenant repair SLA configuration. */
export type RepairSlaConfigInput = z.infer<typeof repairSlaConfigSchema>;

/**
 * The shipped defaults: the master spec §G.4 SLA targets and the FR-G-9 default
 * badge thresholds. Used when a tenant has configured nothing, so out-of-the-box
 * behaviour is identical to the pre-configuration constants.
 */
export const DEFAULT_REPAIR_SLA_CONFIG: RepairSlaConfigInput = {
  emergencyTargetHours: 4,
  urgentTargetHours: 24,
  standardTargetHours: 48,
  lowTargetWorkingDays: 5,
  dueSoonThresholdPercent: 50,
  atRiskThresholdPercent: 75,
};
