import { describe, expect, it } from 'vitest';

import { feedbackDecisionStatus } from '@estate/validators';

import {
  listPublishedFeedback,
  type PublishedFeedbackReader,
  type PublishedFeedbackRow,
} from '../../app/(app)/lib/published-feedback.js';
import { testimonialsDataDrivenBlockSchema } from '../../components/blocks/TestimonialsBlockDataDriven.js';

// EPIC-AC integration (AC #6) — the full public-testimonials flow, wired end to
// end over an in-memory feedback store: submit → moderate (publish) → the public
// read model surfaces it with ONLY the safe fields. Uses the REAL read model, the
// REAL moderation-status mapping (@estate/validators feedbackDecisionStatus) and
// the REAL data-driven block schema, so the contract between the moderation write
// and the public read is exercised without a database. The Testcontainers Postgres
// pass lives in the data-layer integration suite; this proves the surface logic.

interface StoredFeedback {
  id: string;
  tenantId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  status: 'pending' | 'published' | 'rejected';
  publishAsTestimonial: boolean;
  // Sensitive columns that must NEVER surface publicly.
  respondentRef: string | null;
  triggerType: string;
  agentActor: string | null;
}

/** A tiny in-memory store that satisfies the structural PublishedFeedbackReader. */
function store(rows: StoredFeedback[], tenantId: string): PublishedFeedbackReader {
  const scoped = (where: Record<string, unknown>) =>
    rows
      .filter((r) => r.tenantId === tenantId)
      .filter((r) => where['status'] === undefined || r.status === where['status'])
      .filter(
        (r) =>
          where['publishAsTestimonial'] === undefined ||
          r.publishAsTestimonial === where['publishAsTestimonial'],
      );
  return {
    feedback: {
      async findMany(args) {
        const matched = scoped(args.where ?? {}).sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
        const skip = args.skip ?? 0;
        const take = args.take ?? matched.length;
        return matched
          .slice(skip, skip + take)
          .map((r) => r as unknown as PublishedFeedbackRow);
      },
      async count(args) {
        return scoped(args.where ?? {}).length;
      },
    },
  };
}

const TENANT = 'tenant-A';

function submit(over: Partial<StoredFeedback>): StoredFeedback {
  return {
    id: crypto.randomUUID(),
    tenantId: TENANT,
    rating: 5,
    comment: 'Excellent from start to finish.',
    createdAt: new Date('2026-06-01T09:00:00Z'),
    status: 'pending',
    publishAsTestimonial: true,
    respondentRef: 'anon-secret',
    triggerType: 'viewing_attended',
    agentActor: 'agent-secret',
    ...over,
  };
}

describe('published-feedback surface (integration)', () => {
  it('surfaces feedback only AFTER it is moderated to published', async () => {
    const feedback = submit({ comment: 'Sold in a week.' });
    const db = () => store([feedback], TENANT);

    // Pending — nothing public yet.
    expect((await listPublishedFeedback(db())).items).toEqual([]);

    // Admin publishes it (the real moderation-status mapping).
    feedback.status = feedbackDecisionStatus('publish');
    expect(feedback.status).toBe('published');

    // Now it appears, projected to the safe fields only.
    const result = await listPublishedFeedback(db());
    expect(result.items).toEqual([
      {
        id: feedback.id,
        rating: 5,
        comment: 'Sold in a week.',
        createdAt: feedback.createdAt,
      },
    ]);
  });

  it('never surfaces pending or rejected feedback, or feedback not marked publishable', async () => {
    const rows = [
      submit({ status: 'pending' }),
      submit({ status: 'rejected' }),
      submit({ status: 'published', publishAsTestimonial: false }),
      submit({ status: 'published', publishAsTestimonial: true, comment: 'Visible one.' }),
    ];
    const result = await listPublishedFeedback(store(rows, TENANT));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.comment).toBe('Visible one.');
  });

  it('isolates one tenant from another', async () => {
    const mine = submit({ status: 'published', comment: 'Mine.' });
    const theirs = submit({
      tenantId: 'tenant-B',
      status: 'published',
      comment: 'Theirs.',
    });
    const result = await listPublishedFeedback(store([mine, theirs], TENANT));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.comment).toBe('Mine.');
  });

  it('projects out every sensitive field on the published row', async () => {
    const feedback = submit({ status: 'published' });
    const { items } = await listPublishedFeedback(store([feedback], TENANT));

    const serialised = JSON.stringify(items);
    expect(serialised).not.toContain('anon-secret');
    expect(serialised).not.toContain('viewing_attended');
    expect(serialised).not.toContain('agent-secret');
  });

  it('the data-driven block schema accepts the CMS toggle config it is given', () => {
    expect(testimonialsDataDrivenBlockSchema.safeParse({ heading: 'Reviews', limit: 6 }).success).toBe(
      true,
    );
  });
});
