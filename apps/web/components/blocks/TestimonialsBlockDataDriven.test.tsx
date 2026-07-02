// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the modules TestimonialsBlockDataDriven dynamically imports at render, so the
// async fetch->project->render path runs without a real DB. listPublishedFeedback is
// the REAL read model over the fake tx, so the published-only + safe-field projection
// is genuinely exercised end-to-end.
const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ feedback: { findMany, count } }),
}));
vi.mock('../../app/(app)/lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('../../app/(app)/lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));

const { TestimonialsBlockDataDriven, testimonialsDataDrivenBlockSchema } =
  await import('./TestimonialsBlockDataDriven.js');

const fbRow = {
  id: 'f1',
  rating: 5,
  comment: 'Sold our home in under a week.',
  createdAt: new Date('2026-04-01T09:00:00Z'),
  // Sensitive columns present on the row must NOT reach the DOM.
  respondentRef: 'anon-42',
  triggerType: 'sale_completed',
  agentActor: 'agent-3',
};

describe('TestimonialsBlockDataDriven', () => {
  it('fetches published feedback and renders each as a testimonial quote', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(1);

    const ui = await TestimonialsBlockDataDriven({
      data: { heading: 'What clients say', limit: 6 },
    });
    render(ui);

    expect(screen.getByRole('heading', { name: 'What clients say' })).toBeInTheDocument();
    expect(screen.getByText(/Sold our home in under a week\./)).toBeInTheDocument();
    // The read model filters to published, publishable feedback only.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', publishAsTestimonial: true },
        take: 6,
      }),
    );
  });

  it('never leaks sensitive fields (respondent, trigger, agent) into the markup', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(1);

    const { container } = render(await TestimonialsBlockDataDriven({ data: {} }));

    expect(container.innerHTML).not.toContain('anon-42');
    expect(container.innerHTML).not.toContain('sale_completed');
    expect(container.innerHTML).not.toContain('agent-3');
  });

  it('renders the rating accessibly (out of five)', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(1);

    render(await TestimonialsBlockDataDriven({ data: {} }));

    expect(screen.getByLabelText(/5 out of 5/i)).toBeInTheDocument();
  });

  it('renders quotes as semantic blockquotes', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(1);

    const { container } = render(await TestimonialsBlockDataDriven({ data: {} }));
    expect(container.querySelectorAll('blockquote').length).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing when there is no published feedback (graceful empty)', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const ui = await TestimonialsBlockDataDriven({ data: {} });
    expect(ui).toBeNull();
  });

  it('renders nothing when the fetch fails (fail-soft, page never breaks)', async () => {
    findMany.mockRejectedValue(new Error('db down'));
    count.mockRejectedValue(new Error('db down'));

    const ui = await TestimonialsBlockDataDriven({ data: {} });
    expect(ui).toBeNull();
  });

  it('schema accepts an optional heading + limit and rejects a non-numeric limit', () => {
    expect(testimonialsDataDrivenBlockSchema.safeParse({}).success).toBe(true);
    expect(
      testimonialsDataDrivenBlockSchema.safeParse({ heading: 'Reviews', limit: 3 }).success,
    ).toBe(true);
    expect(testimonialsDataDrivenBlockSchema.safeParse({ limit: 'lots' }).success).toBe(false);
  });
});
