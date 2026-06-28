import type { PropertySearch } from '@estate/validators';

import { activeChips, toSearchQuery } from '../../(public)/properties/search-params.js';

// EPIC-T FR-T-8 — pure presenters for a saved search's stored filters. Reuses the
// catalogue's chip/query helpers (the /properties URL is the single source of truth
// for filter state) so a saved search's criteria render and re-run identically to
// the live filter bar. No DB, no React — unit-tested so the route stays thin.

/**
 * A human-readable summary of a saved search's filters (the active-filter chip
 * labels, joined). When no filter is active the search matches everything, so it
 * reads "All properties".
 */
export function criteriaSummary(filters: PropertySearch): string {
  const labels = activeChips(filters).map((chip) => chip.label);
  return labels.length > 0 ? labels.join(' · ') : 'All properties';
}

/** The `/properties` URL (with query) that re-runs a saved search's filters. */
export function runSearchHref(filters: PropertySearch): string {
  return `/properties${toSearchQuery(filters)}`;
}
