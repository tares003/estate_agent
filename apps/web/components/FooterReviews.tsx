import { withTenant } from '@estate/db';

import { getDb } from '../app/(app)/lib/db.js';
import {
  feedbackAggregate,
  type FeedbackAggregateReader,
} from '../app/(app)/lib/feedback-aggregate.js';
import { getCurrentTenantId } from '../app/(app)/lib/tenant.js';
import { ReviewsBadge } from './ReviewsBadge.js';

// EPIC-AC FR-AC-6 (the live reviews badge): async server-component GLUE — it
// resolves the current tenant, reads the feedback aggregate inside the tenant RLS
// scope, and renders the presentational ReviewsBadge. Like SiteHeader it touches
// the request + DB, so it is verified by runtime smoke / e2e and excluded from
// unit coverage (the testable parts are feedbackAggregate + ReviewsBadge).
//
// Resilient: any failure to resolve the tenant or read the aggregate falls back to
// rendering nothing, so the footer always renders — the badge is progressive
// enhancement, never a hard dependency of the page.
//
// FR-AC-6 also asks for the aggregate to be "cached at a configurable interval"
// (default 15 minutes per the brief's acceptance criteria). That cache is a
// follow-on; for now the aggregate is read live at render time (one cheap COUNT +
// AVG per request), which the badge tolerates.

async function resolveAggregate(): Promise<{ average: number; count: number }> {
  try {
    const tenantId = await getCurrentTenantId();
    return await withTenant(getDb(), tenantId, (tx) =>
      feedbackAggregate(tx as unknown as FeedbackAggregateReader),
    );
  } catch {
    return { average: 0, count: 0 };
  }
}

export async function FooterReviews() {
  const { average, count } = await resolveAggregate();
  return <ReviewsBadge average={average} count={count} />;
}
