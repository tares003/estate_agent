// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// read; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ feedback: { findMany } }),
}));

// The per-row control is exercised in its own test; stub it to the feedback id.
vi.mock('./FeedbackModerationControls.js', () => ({
  FeedbackModerationControls: ({ feedbackId }: { feedbackId: string }) => (
    <div data-testid="moderation-controls">{feedbackId}</div>
  ),
}));

const { default: FeedbackModerationPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
});

describe('FeedbackModerationPage', () => {
  it('gates on the feedback.read permission before reading', async () => {
    findMany.mockResolvedValue([]);
    render(await FeedbackModerationPage());

    expect(requireStaffPermission).toHaveBeenCalledWith('feedback.read');
  });

  it('renders the heading + a row per pending publishable entry', async () => {
    findMany.mockResolvedValue([
      {
        id: 'fb-1',
        rating: 5,
        comment: 'Brilliant service.',
        status: 'pending',
        publishAsTestimonial: true,
        needsResponse: true,
        triggerType: 'viewing',
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
      {
        id: 'fb-2',
        rating: 2,
        comment: null,
        status: 'pending',
        publishAsTestimonial: true,
        needsResponse: false,
        triggerType: 'repair',
        createdAt: new Date('2026-06-02T10:00:00Z'),
      },
    ]);

    render(await FeedbackModerationPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Feedback moderation' }),
    ).toBeInTheDocument();

    // The read model is scoped to PENDING + PUBLISHABLE, newest first.
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'pending', publishAsTestimonial: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    expect(screen.getByText('Brilliant service.')).toBeInTheDocument();
    expect(screen.getByText(/Needs response/i)).toBeInTheDocument();
    const controls = screen.getAllByTestId('moderation-controls');
    expect(controls).toHaveLength(2);
    expect(controls[0]).toHaveTextContent('fb-1');
  });

  it('shows a calm empty state when the queue is clear', async () => {
    findMany.mockResolvedValue([]);
    render(await FeedbackModerationPage());

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/no feedback is waiting/i)).toBeInTheDocument();
  });
});
