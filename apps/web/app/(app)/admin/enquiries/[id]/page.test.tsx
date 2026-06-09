// responsive-coverage: opt-out all — asserts the detail composition + the
// tenant-scoped reads + the not-found path; layout is the admin-routes Playwright
// pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

// The action forms are client components (useActionState/useRouter); stub them so
// the RSC page test focuses on composition + the tenant-scoped reads.
vi.mock('./StatusChanger.js', () => ({
  StatusChanger: ({ enquiryId }: { enquiryId: string }) => (
    <div data-testid="status-changer">{enquiryId}</div>
  ),
}));
vi.mock('./NoteComposer.js', () => ({
  NoteComposer: ({ enquiryId }: { enquiryId: string }) => (
    <div data-testid="note-composer">{enquiryId}</div>
  ),
}));
vi.mock('./ConvertForm.js', () => ({
  ConvertForm: ({ enquiryId }: { enquiryId: string }) => (
    <div data-testid="convert-form">{enquiryId}</div>
  ),
}));

const findFirst = vi.fn();
const noteFindMany = vi.fn();
const eventFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      enquiry: { findFirst },
      note: { findMany: noteFindMany },
      enquiryStatusEvent: { findMany: eventFindMany },
    }),
}));

const { default: EnquiryDetailPage } = await import('./page.js');

const enquiry = {
  id: 'e1',
  name: 'Sam Buyer',
  email: 'sam@example.com',
  phone: '07700900000',
  message: 'Interested in the Didsbury semi.',
  status: 'new',
  createdAt: new Date('2026-06-09T11:00:00.000Z'),
};

function props(id = 'e1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(enquiry);
  noteFindMany.mockResolvedValue([
    {
      id: 'n1',
      body: 'Left a voicemail.',
      isInternal: true,
      authorAgentId: null,
      createdAt: new Date('2026-06-09T11:30:00.000Z'),
    },
  ]);
  eventFindMany.mockResolvedValue([
    {
      id: 'ev1',
      fromStatus: null,
      toStatus: 'new',
      changedByAgentId: null,
      changedAt: new Date('2026-06-09T11:00:00.000Z'),
    },
  ]);
});

describe('EnquiryDetailPage', () => {
  it('renders the summary, status badge, changer, and the note thread', async () => {
    render(await EnquiryDetailPage(props()));

    expect(screen.getByRole('heading', { level: 1, name: 'Sam Buyer' })).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByText('Interested in the Didsbury semi.')).toBeInTheDocument();
    // "New" appears as the summary status badge (and again in the timeline)
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    expect(screen.getByTestId('status-changer')).toHaveTextContent('e1');
    expect(screen.getByTestId('note-composer')).toHaveTextContent('e1');
    expect(screen.getByText('Left a voicemail.')).toBeInTheDocument();
    // the status activity timeline renders under its own section
    expect(screen.getByRole('region', { name: 'Activity' })).toBeInTheDocument();
    // a `new` enquiry cannot yet be converted, so no convert form is offered
    expect(screen.queryByTestId('convert-form')).not.toBeInTheDocument();
  });

  it('offers the convert form once the enquiry can reach converted', async () => {
    findFirst.mockResolvedValue({ ...enquiry, status: 'contacted' });
    render(await EnquiryDetailPage(props()));
    expect(screen.getByTestId('convert-form')).toHaveTextContent('e1');
  });

  it('reads the enquiry + notes tenant-scoped and 404s a missing enquiry', async () => {
    findFirst.mockResolvedValue(null);
    await expect(EnquiryDetailPage(props('missing'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'missing' } });
    expect(noteFindMany).not.toHaveBeenCalled();
  });
});
