// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// property fetch + the not-found path; the form is covered by ViewingForm.test.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) => fn({}),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const getPropertyBySlug = vi.fn();
vi.mock('../../../../lib/properties.js', () => ({
  getPropertyBySlug: (...args: unknown[]) => getPropertyBySlug(...args),
}));

vi.mock('./ViewingForm.js', () => ({
  ViewingForm: ({ propertyId }: { propertyId: string }) => (
    <div data-testid="viewing-form">{propertyId}</div>
  ),
}));

const { default: BookViewingPage, generateMetadata } = await import('./page.js');

function props(slug = 'palatine-road-m20') {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getPropertyBySlug.mockResolvedValue({
    id: 'p1',
    slug: 'palatine-road-m20',
    title: 'Edwardian semi',
    displayAddress: 'Palatine Road, Didsbury',
  });
});

describe('BookViewingPage', () => {
  it('renders the heading + the viewing form for the fetched property', async () => {
    render(await BookViewingPage(props()));
    expect(screen.getByRole('heading', { level: 1, name: 'Book a viewing' })).toBeInTheDocument();
    expect(screen.getByText('Palatine Road, Didsbury')).toBeInTheDocument();
    expect(screen.getByTestId('viewing-form')).toHaveTextContent('p1');
  });

  it('404s an unknown property', async () => {
    getPropertyBySlug.mockResolvedValue(null);
    await expect(BookViewingPage(props('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('builds canonical, non-indexed metadata', async () => {
    const meta = await generateMetadata(props());
    expect(meta.alternates?.canonical).toBe(
      'https://acme.test/properties/palatine-road-m20/viewing',
    );
    expect(meta.robots).toMatchObject({ index: false });
  });
});
