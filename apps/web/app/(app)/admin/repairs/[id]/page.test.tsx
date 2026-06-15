// responsive-coverage: opt-out all — asserts the detail composition + the
// tenant-scoped read + the not-found path; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

// The control is a client component (useActionState/useRouter); stub it so the RSC
// page test focuses on the composition + the tenant-scoped read.
vi.mock('./RepairStatusControl.js', () => ({
  RepairStatusControl: ({
    repairId,
    options,
  }: {
    repairId: string;
    options: Array<{ value: string }>;
  }) => (
    <div data-testid="repair-status-control">
      {`${repairId}:${options.map((o) => o.value).join(',')}`}
    </div>
  ),
}));
vi.mock('./RepairTimeline.js', () => ({
  RepairTimeline: ({ events }: { events: Array<{ id: string }> }) => (
    <div data-testid="repair-timeline">{events.length}</div>
  ),
}));
vi.mock('./AssignContractorControl.js', () => ({
  AssignContractorControl: ({
    contractors,
    assignedContractorName,
  }: {
    contractors: Array<{ id: string }>;
    assignedContractorName: string | null;
  }) => (
    <div data-testid="assign-contractor-control">
      {`${assignedContractorName ?? 'none'}:${contractors.length}`}
    </div>
  ),
}));
vi.mock('./PropertyMatchControl.js', () => ({
  PropertyMatchControl: ({
    current,
    choices,
  }: {
    current: string | null;
    choices: Array<{ id: string }>;
  }) => <div data-testid="property-match-control">{`${current ?? 'none'}:${choices.length}`}</div>,
}));

const repairFindFirst = vi.fn();
const eventFindMany = vi.fn();
const propertyFindMany = vi.fn();
const fileFindMany = vi.fn();
const contractorFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      repairRequest: { findFirst: repairFindFirst },
      repairStatusEvent: { findMany: eventFindMany },
      property: { findMany: propertyFindMany },
      repairFile: { findMany: fileFindMany },
      contractor: { findMany: contractorFindMany },
    }),
}));
vi.mock('../../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));

const { default: RepairDetailPage } = await import('./page.js');

const repair = {
  id: 'r1',
  name: 'Tess Tenant',
  email: 'tess@example.com',
  phone: '07700900000',
  reference: 'RPR-2026-00042',
  propertyReference: 'Flat 2, 14 Palatine Road',
  propertyId: null,
  assignedContractorId: null,
  category: 'Plumbing',
  description: 'The kitchen tap is leaking steadily.',
  urgency: 'urgent',
  status: 'new',
  rejectedReason: null,
  createdAt: new Date('2026-06-09T10:00:00.000Z'),
  updatedAt: new Date('2026-06-09T10:00:00.000Z'),
};

function props(id = 'r1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  repairFindFirst.mockResolvedValue(repair);
  propertyFindMany.mockResolvedValue([
    { id: 'p1', displayAddress: '1 Acacia Avenue' },
    { id: 'p2', displayAddress: '2 Birch Road' },
  ]);
  fileFindMany.mockResolvedValue([
    {
      id: 'f1',
      url: 'tenants/t1/repairs/r1/leak.jpg',
      fileName: 'leak.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
      uploadedBy: 'tenant',
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
    },
  ]);
  contractorFindMany.mockResolvedValue([
    {
      id: 'k1',
      name: 'Ace Plumbing',
      email: 'ace@example.com',
      phone: null,
      trade: 'Plumbing',
      active: true,
    },
    {
      id: 'k2',
      name: 'Old Co',
      email: 'old@example.com',
      phone: null,
      trade: null,
      active: false,
    },
  ]);
  eventFindMany.mockResolvedValue([
    {
      id: 'ev1',
      fromStatus: null,
      toStatus: 'new',
      actorUserId: null,
      notes: null,
      createdAt: new Date('2026-06-09T10:00:00.000Z'),
    },
  ]);
});

describe('RepairDetailPage', () => {
  it('renders the ticket header, description, control with legal next statuses, and history', async () => {
    render(await RepairDetailPage(props()));

    expect(
      screen.getByRole('heading', { level: 1, name: /Repair — Tess Tenant/ }),
    ).toBeInTheDocument();
    // the §G.2 ticket meta carries the human-readable reference
    expect(screen.getByText(/RPR-2026-00042/)).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('The kitchen tap is leaking steadily.')).toBeInTheDocument();
    expect(screen.getByText('Flat 2, 14 Palatine Road')).toBeInTheDocument();
    expect(screen.getByText('tess@example.com')).toBeInTheDocument();
    // the §G.5 allow-list for `new`
    expect(screen.getByTestId('repair-status-control')).toHaveTextContent(
      'r1:triaged,awaiting_tenant,on_hold,rejected',
    );
    expect(screen.getByTestId('repair-timeline')).toHaveTextContent('1');
    // FR-G-2: the ticket attachments, served via signed links
    expect(screen.getByRole('heading', { level: 2, name: 'Files' })).toBeInTheDocument();
    const fileLink = screen.getByRole('link', { name: /leak\.jpg/ });
    expect(fileLink).toHaveAttribute(
      'href',
      '/api/storage/object?token=tok:tenants/t1/repairs/r1/leak.jpg',
    );
    // §G.6: property matching — the control gets the tenant's listings
    expect(screen.getByTestId('property-match-control')).toHaveTextContent('none:2');
    // FR-G-8: the assign control gets the ACTIVE contractors (1 of 2) + no assignee
    expect(screen.getByTestId('assign-contractor-control')).toHaveTextContent('none:1');
    expect(repairFindFirst).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(eventFindMany).toHaveBeenCalledWith({
      where: { repairRequestId: 'r1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('links the matched catalogue listing when the ticket is matched', async () => {
    repairFindFirst.mockResolvedValue({ ...repair, propertyId: 'p1' });
    render(await RepairDetailPage(props()));
    expect(screen.getByTestId('property-match-control')).toHaveTextContent('p1:2');
    expect(screen.getByRole('link', { name: /1 Acacia Avenue/ })).toHaveAttribute(
      'href',
      '/admin/properties/p1',
    );
  });

  it('shows the rejection reason on a rejected ticket', async () => {
    repairFindFirst.mockResolvedValue({
      ...repair,
      status: 'rejected',
      rejectedReason: 'Tenant-caused damage.',
    });
    render(await RepairDetailPage(props()));
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Tenant-caused damage\./)).toBeInTheDocument();
  });

  it('404s an unknown ticket', async () => {
    repairFindFirst.mockResolvedValue(null);
    await expect(RepairDetailPage(props('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
