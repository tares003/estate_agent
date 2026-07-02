// responsive-coverage: opt-out all — this asserts the data → list composition,
// pagination links and the empty state; the responsive layout is covered by the
// page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ feedback: { findMany, count } }),
}));

const { default: TestimonialsPage, generateMetadata } = await import('./page.js');

const fbRow = {
  id: 'f1',
  rating: 5,
  comment: 'They found us the perfect home.',
  createdAt: new Date('2026-03-01T09:00:00Z'),
  respondentRef: 'anon-1',
  triggerType: 'viewing_attended',
  agentActor: 'agent-1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TestimonialsPage', () => {
  it('renders published testimonials (filtered to published, publishable feedback)', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(1);

    render(await TestimonialsPage({ searchParams: Promise.resolve({}) }));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', publishAsTestimonial: true },
      }),
    );
    expect(screen.getByText(/They found us the perfect home\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /testimonials/i })).toBeInTheDocument();
  });

  it('never exposes sensitive fields (respondent, trigger, agent) in the DOM', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(1);

    const { container } = render(await TestimonialsPage({ searchParams: Promise.resolve({}) }));

    expect(container.innerHTML).not.toContain('anon-1');
    expect(container.innerHTML).not.toContain('viewing_attended');
    expect(container.innerHTML).not.toContain('agent-1');
  });

  it('renders the empty state when there is no published feedback', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    render(await TestimonialsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/No testimonials to show just yet/i)).toBeInTheDocument();
  });

  it('renders pagination links across more than one page', async () => {
    findMany.mockResolvedValue([fbRow]);
    count.mockResolvedValue(25);

    render(await TestimonialsPage({ searchParams: Promise.resolve({ page: '2' }) }));

    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/testimonials',
    );
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/testimonials?page=3',
    );
  });

  it('emits a canonical, OG and Twitter metadata set (FR-O-4)', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/testimonials');
    expect(meta.openGraph?.url).toBe('https://acme.test/testimonials');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
