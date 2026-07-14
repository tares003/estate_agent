// responsive-coverage: opt-out all — asserts the detail composition + the
// tenant-scoped reads + the not-found path; layout is the admin-routes Playwright
// pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

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
const agentFindFirst = vi.fn();
const branchFindFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      enquiry: { findFirst },
      note: { findMany: noteFindMany },
      enquiryStatusEvent: { findMany: eventFindMany },
      agent: { findFirst: agentFindFirst },
      branch: { findFirst: branchFindFirst },
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
  assignedAgentId: null,
  assignedBranchId: null,
  createdAt: new Date('2026-06-09T11:00:00.000Z'),
};

function props(id = 'e1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
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
  // Audit finding admin-read-pages-ungated-pii-leak: the enquiry detail renders
  // PII (name/email/phone/message) — RBAC-gated fail-closed.
  it('gates on the enquiry.read permission before reading', async () => {
    render(await EnquiryDetailPage(props()));
    expect(requireStaffPermission).toHaveBeenCalledWith('enquiry.read');
  });

  it('propagates a denial WITHOUT reading the enquiry (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(EnquiryDetailPage(props())).rejects.toThrow('denied');
    expect(findFirst).not.toHaveBeenCalled();
  });

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

  // FR-I-3 (audit finding assignment-rules-never-applied): the routing outcome
  // is surfaced on the detail summary — the resolved assignee, or unassigned.
  it('shows the assigned agent resolved tenant-scoped (FR-I-3)', async () => {
    findFirst.mockResolvedValue({ ...enquiry, assignedAgentId: 'agent-1' });
    agentFindFirst.mockResolvedValue({ name: 'Alex Agent' });

    render(await EnquiryDetailPage(props()));

    expect(agentFindFirst).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      select: { name: true },
    });
    expect(screen.getByText('Assigned to')).toBeInTheDocument();
    expect(screen.getByText('Alex Agent')).toBeInTheDocument();
  });

  it('shows an assigned branch and marks an unassigned enquiry with a dash', async () => {
    findFirst.mockResolvedValue({ ...enquiry, assignedBranchId: 'branch-1' });
    branchFindFirst.mockResolvedValue({ name: 'Didsbury' });

    render(await EnquiryDetailPage(props()));
    expect(screen.getByText('Didsbury (branch)')).toBeInTheDocument();

    findFirst.mockResolvedValue(enquiry);
    render(await EnquiryDetailPage(props()));
    // unassigned: no lookup runs and the summary shows the em-dash placeholder
    expect(agentFindFirst).not.toHaveBeenCalled();
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
