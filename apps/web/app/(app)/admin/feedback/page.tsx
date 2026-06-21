import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import {
  listFeedbackForModeration,
  type FeedbackQueueReader,
  type FeedbackQueueRow,
} from './feedback-queue.js';
import { FeedbackModerationControls } from './FeedbackModerationControls.js';

// EPIC-AC FR-AC-5 (master spec §AC) — the feedback moderation queue. Gates on
// `feedback.read` (RBAC fail-closed), resolves the tenant, reads the PENDING +
// PUBLISHABLE feedback inside the tenant RLS scope, and renders one row per entry
// with its publish / reject control. The read model + the per-row control are
// unit-tested, so this route stays a thin composition. Renders inside the admin
// shell's `main` landmark.

export const dynamic = 'force-dynamic';

/** Title-case the trigger enum (e.g. `repair` → `Repair`) for display. */
function triggerLabel(trigger: string): string {
  return trigger.charAt(0).toUpperCase() + trigger.slice(1);
}

export default async function FeedbackModerationPage() {
  await requireStaffPermission('feedback.read');

  const tenantId = await getCurrentTenantId();
  const rows = await withTenant(getDb(), tenantId, (tx) =>
    listFeedbackForModeration(tx as unknown as FeedbackQueueReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Feedback moderation</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Feedback whose author asked you to publish it as a testimonial. Publish it to show it on
          the site, or reject it with a reason. Decisions are recorded in the audit log.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No feedback is waiting for a decision. Entries appear here when someone asks you to publish
          their feedback as a testimonial.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Rating
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Comment
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Trigger
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                Decision
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: FeedbackQueueRow) => (
              <tr key={row.id} className="border-divider border-b align-top">
                <td className="t-body-md py-3 pr-4 whitespace-nowrap">{row.rating} / 5</td>
                <td className="t-body-md py-3 pr-4">
                  <div className="flex flex-col gap-2 max-w-[40ch]">
                    <span>{row.comment ?? '—'}</span>
                    {row.needsResponse ? <Badge tone="warning">Needs response</Badge> : null}
                  </div>
                </td>
                <td className="t-body-md py-3 pr-4 whitespace-nowrap">
                  {triggerLabel(row.triggerType)}
                </td>
                <td className="py-3">
                  <FeedbackModerationControls feedbackId={row.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
