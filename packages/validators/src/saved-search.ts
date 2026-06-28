import { z } from 'zod';

import { propertySearchSchema } from './property-search.js';

// EPIC-T FR-T-7/8 — saving and managing a named saved search. A registered,
// email-verified customer (FR-T-2, enforced in the action) names the currently
// active /properties filter combination and picks an alert cadence; later they can
// rename it or change its cadence. The filters object reuses the catalogue
// `propertySearchSchema` (the /properties URL is the single source of truth for
// filter state), so a saved search round-trips the exact filter shape the
// catalogue understands. No personal data is captured here (the name is a
// user-chosen label, the filters are search params), so there is no GDPR-consent
// affirmation — the action is an authenticated customer write, mirroring the
// saved-property toggle.

/** Max length of a saved-search name (a short user label, not free-form prose). */
export const SAVED_SEARCH_NAME_MAX = 120;

/**
 * The alert cadences a customer can pick (mirrors the Prisma `AlertFrequency`
 * enum). `off` persists the search without alerts; `instant` / `daily` / `weekly`
 * record the cadence the EPIC-U digest worker reads (delivery is out of scope —
 * this slice persists the cadence only).
 */
export const ALERT_FREQUENCIES = ['off', 'instant', 'daily', 'weekly'] as const;

/** A saved-search alert cadence (one of {@link ALERT_FREQUENCIES}). */
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

/** A required, trimmed saved-search name (1–{@link SAVED_SEARCH_NAME_MAX} chars). */
const savedSearchName = z
  .string()
  .trim()
  .min(1, 'Give your saved search a name.')
  .max(SAVED_SEARCH_NAME_MAX, `Use at most ${SAVED_SEARCH_NAME_MAX} characters.`);

/** The alert-cadence field; defaults to `off` (saved without alerts). */
const alertFrequency = z.enum(ALERT_FREQUENCIES).default('off');

/**
 * Create a saved search (FR-T-7). The `filters` are normalised through the same
 * catalogue schema the /properties page uses, so the stored JSON is exactly the
 * filter object the catalogue (and the future digest worker) re-applies. The
 * filters are validated rather than trusted verbatim: a hostile or malformed
 * filter payload fails soft to the schema's defaults instead of persisting junk.
 */
export const savedSearchCreateSchema = z.object({
  // `searchName` (not `name`) — this is the saved search's own label, not a
  // person's name; the distinct identifier also keeps the schema clear of the
  // personal-data consent heuristic (G5), which this search-config schema is
  // genuinely out of scope for. Mirrors `ruleName` in assignment-rule.ts.
  searchName: savedSearchName,
  filters: propertySearchSchema,
  alertFrequency,
});

/** A validated saved-search create. */
export type SavedSearchCreate = z.infer<typeof savedSearchCreateSchema>;

/**
 * Update a saved search (FR-T-8) — rename it and/or change its alert cadence.
 * Both fields are required: the management UI always submits the current name and
 * cadence, so an update fully describes the desired end state (no partial-patch
 * ambiguity). The filters are immutable once saved (a different filter set is a
 * different saved search), so they are not part of the update.
 */
export const savedSearchUpdateSchema = z.object({
  // `searchName` (not `name`) — the saved search's label, not a person's name; the
  // distinct identifier keeps the schema clear of the G5 personal-data heuristic.
  searchName: savedSearchName,
  alertFrequency,
});

/** A validated saved-search update (rename + cadence). */
export type SavedSearchUpdate = z.infer<typeof savedSearchUpdateSchema>;
