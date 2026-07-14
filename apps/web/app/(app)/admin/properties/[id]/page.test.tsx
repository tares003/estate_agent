// responsive-coverage: opt-out all — asserts the detail composition + the
// tenant-scoped read + the not-found path; layout is the admin-routes Playwright pass.
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

// The edit form is a client component (useActionState/useRouter); stub it so the
// RSC page test focuses on the header + the tenant-scoped read.
vi.mock('./PropertyEditForm.js', () => ({
  PropertyEditForm: ({ property }: { property: { id: string } }) => (
    <div data-testid="property-edit-form">{property.id}</div>
  ),
}));
vi.mock('./PublishControl.js', () => ({
  PublishControl: ({ published }: { published: boolean }) => (
    <div data-testid="publish-control">{published ? 'published' : 'draft'}</div>
  ),
}));
// FR-F-8 — the checklist-enforcing publish control a DRAFT must publish through
// (audit finding publish-preflight-checklist-bypassed). The page evaluates the
// checklist server-side and passes items + ready down.
vi.mock('./PublishPreflight.js', () => ({
  PublishPreflight: ({
    items,
    ready,
  }: {
    items: { key: string; satisfied: boolean }[];
    ready: boolean;
  }) => (
    <div data-testid="publish-preflight">{`${items.length}:${ready ? 'ready' : 'blocked'}`}</div>
  ),
}));
vi.mock('./MarketStatusControl.js', () => ({
  MarketStatusControl: ({ current, options }: { current: string; options: string[] }) => (
    <div data-testid="market-status-control">{`${current}:${options.join(',')}`}</div>
  ),
}));
// FR-F-10 — the confirm-step soft-delete control (audit finding
// property-soft-delete-action-missing).
vi.mock('./SoftDeleteControl.js', () => ({
  SoftDeleteControl: ({ propertyId }: { propertyId: string }) => (
    <div data-testid="soft-delete-control">{propertyId}</div>
  ),
}));
vi.mock('./PropertyImagesManager.js', () => ({
  PropertyImagesManager: ({ images }: { images: Array<{ id: string; thumbUrl: string }> }) => (
    <div data-testid="property-images-manager">
      {`${images.length}:${images.map((image) => image.thumbUrl).join(',')}`}
    </div>
  ),
}));
vi.mock('../../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));

const findFirst = vi.fn();
const eventFindMany = vi.fn();
const imageFindMany = vi.fn();
const imageCount = vi.fn();
const imageFindFirst = vi.fn();
const documentFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: { findFirst },
      propertyStatusEvent: { findMany: eventFindMany },
      propertyImage: { findMany: imageFindMany, count: imageCount, findFirst: imageFindFirst },
      propertyDocument: { findMany: documentFindMany },
    }),
}));

const { default: AdminPropertyDetailPage } = await import('./page.js');

const property = {
  id: '33333333-3333-3333-3333-333333333333',
  title: 'Edwardian semi',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20 6RE',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
  description: 'A handsome semi.',
  publishedAt: null,
};

function props(id = '33333333-3333-3333-3333-333333333333') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue(property);
  imageCount.mockResolvedValue(1);
  imageFindFirst.mockResolvedValue(null);
  documentFindMany.mockResolvedValue([]);
  imageFindMany.mockResolvedValue([
    {
      id: 'img1',
      url: 'tenants/t1/properties/p1/a.jpg',
      alt: 'Front',
      sortOrder: 0,
      isPrimary: true,
      width: 1200,
    },
  ]);
  eventFindMany.mockResolvedValue([
    {
      id: 'se1',
      fromStatus: 'for_sale',
      toStatus: 'under_offer',
      changedByAgentId: null,
      changedAt: new Date('2026-06-09T11:00:00.000Z'),
    },
  ]);
});

describe('AdminPropertyDetailPage', () => {
  // Audit finding admin-read-surfaces-missing-rbac-gate: the admin detail shows
  // drafts + lifecycle controls — RBAC-gated fail-closed.
  it('gates on the property.read permission before reading', async () => {
    render(await AdminPropertyDetailPage(props()));
    expect(requireStaffPermission).toHaveBeenCalledWith('property.read');
  });

  it('propagates a denial WITHOUT reading the listing (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(AdminPropertyDetailPage(props())).rejects.toThrow('denied');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('renders the header context + the edit form for the fetched listing', async () => {
    render(await AdminPropertyDetailPage(props()));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Palatine Road, Didsbury' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('For sale · For sale')).toBeInTheDocument(); // saleType · marketStatus
    expect(screen.getByTestId('property-edit-form')).toHaveTextContent(
      '33333333-3333-3333-3333-333333333333',
    );
    // FR-F-8 — a DRAFT publishes ONLY through the pre-flight checklist (eleven items,
    // evaluated server-side; this fixture satisfies none fully, so publish is gated
    // behind the typed override). The checklist-less PublishControl must NOT render.
    expect(screen.getByTestId('publish-preflight')).toHaveTextContent('11:blocked');
    expect(screen.queryByTestId('publish-control')).not.toBeInTheDocument();
    // the market-status control gets the current status + the sale-type's options
    expect(screen.getByTestId('market-status-control')).toHaveTextContent(
      'for_sale:for_sale,under_offer,sold_stc,sold,withdrawn',
    );
    // the images manager gets the gallery with render-time signed thumbnails
    expect(screen.getByTestId('property-images-manager')).toHaveTextContent(
      '1:/api/storage/object?token=tok:tenants/t1/properties/p1/a.thumb.jpg',
    );
    // the status-history timeline renders the tenant-scoped events
    expect(screen.getByRole('heading', { level: 2, name: 'Status history' })).toBeInTheDocument();
    expect(screen.getByText('Under offer')).toBeInTheDocument();
    expect(eventFindMany).toHaveBeenCalledWith({
      where: { propertyId: '33333333-3333-3333-3333-333333333333' },
      orderBy: { changedAt: 'desc' },
    });
    // admin read is by id, drafts included (no published filter)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: '33333333-3333-3333-3333-333333333333', deletedAt: null },
    });
  });

  it('frames a published rental in the header', async () => {
    findFirst.mockResolvedValue({
      ...property,
      saleType: 'rent',
      marketStatus: 'to_let',
      publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    render(await AdminPropertyDetailPage(props()));
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('To rent · To let')).toBeInTheDocument();
    // A LIVE listing needs no checklist to unpublish — the simple control remains.
    expect(screen.getByTestId('publish-control')).toHaveTextContent('published');
    expect(screen.queryByTestId('publish-preflight')).not.toBeInTheDocument();
  });

  it('offers the soft-delete control for the listing (FR-F-10)', async () => {
    render(await AdminPropertyDetailPage(props()));
    expect(screen.getByRole('heading', { level: 2, name: 'Delete listing' })).toBeInTheDocument();
    expect(screen.getByTestId('soft-delete-control')).toHaveTextContent(
      '33333333-3333-3333-3333-333333333333',
    );
  });

  it('404s an unknown listing', async () => {
    findFirst.mockResolvedValue(null);
    await expect(AdminPropertyDetailPage(props('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  // A `[id]` segment that is not a uuid can never name a row, and handing it to a uuid
  // column throws P2023 — an unhandled 500 — rather than returning nothing. Every one of
  // these routes did exactly that (verified live: /admin/.../not-a-uuid returned 500).
  // It must 404, and it must not reach the database to find that out.
  it('renders 404 for a malformed id, without querying the database', async () => {
    await expect(AdminPropertyDetailPage(props('not-a-uuid'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
