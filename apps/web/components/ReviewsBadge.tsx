import type { ReactElement } from 'react';

import type { FeedbackAggregate } from '../app/(app)/lib/feedback-aggregate.js';

// EPIC-AC FR-AC-6: the public reviews badge — a trust marker (G8) presenting the
// tenant's aggregate score (average, 1 dp) out of 5 plus the total review count.
// Pure + props-driven + token-driven (no raw hex/px/ms — G7). It renders NOTHING
// when there is no feedback: the badge never shows a fabricated score. The live
// aggregate is loaded by the FooterReviews glue; this component just presents it.

/** The fixed review scale (1–5 stars per FR-AC-3). */
const SCALE = 5;

/**
 * ReviewsBadge — presents `{ average, count }` as "4.9 / 5 from 1,284 reviews".
 * The count is thousands-grouped for the UK locale and singularised at one. With
 * no reviews (`count === 0`) it returns null so the public surface shows nothing
 * rather than an invented rating.
 */
export function ReviewsBadge({ average, count }: FeedbackAggregate): ReactElement | null {
  if (count === 0) return null;

  const reviewWord = count === 1 ? 'review' : 'reviews';
  return (
    <p className="t-body-sm text-text-secondary inline-flex items-center gap-2">
      <span className="text-text-primary font-semibold">
        {average} / {SCALE}
      </span>
      <span>
        from {count.toLocaleString('en-GB')} {reviewWord}
      </span>
    </p>
  );
}
