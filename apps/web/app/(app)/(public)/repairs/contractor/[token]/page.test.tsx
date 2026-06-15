// responsive-coverage: opt-out all — asserts the portal composition + the token
// gate + PII minimisation; layout is the public-routes Playwright pass.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { signContractorLink } from '../../../../lib/contractor-access.js';

vi.mock('../../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

vi.mock('./ContractorAdvanceControl.js', () => ({
  ContractorAdvanceControl: ({ label }: { label: string }) => (
    <div data-testid="advance-control">{label}</div>
  ),
}));
vi.mock('./ContractorPhotoUpload.js', () => ({
  ContractorPhotoUpload: () => <div data-testid="photo-upload" />,
}));

const findFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ repairRequest: { findFirst } }),
}));

const { default: ContractorPortalPage } = await import('./page.js');

const SECRET = 'test-secret';
const REPAIR = '11111111-1111-1111-1111-111111111111';
const CONTRACTOR = '22222222-2222-2222-2222-222222222222';
const savedSecret = process.env['CONTRACTOR_LINK_SECRET'];

const ticket = {
  id: REPAIR,
  reference: 'RPR-2026-00042',
  category: 'Plumbing',
  urgency: 'urgent',
  status: 'contractor_assigned',
  description: 'The kitchen tap is leaking steadily.',
  propertyReference: 'Flat 2, 14 Palatine Road',
  assignedContractorId: CONTRACTOR,
  // reporter PII — present on the row but must NOT be rendered to the contractor
  email: 'tess@example.com',
  phone: '07700900000',
};

function token(over: { repair?: string; contractor?: string; expiresInMs?: number } = {}): string {
  return signContractorLink(
    over.repair ?? REPAIR,
    over.contractor ?? CONTRACTOR,
    Date.now() + (over.expiresInMs ?? 60_000),
    SECRET,
  );
}

function props(tok: string) {
  return { params: Promise.resolve({ token: tok }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['CONTRACTOR_LINK_SECRET'] = SECRET;
  findFirst.mockResolvedValue(ticket);
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env['CONTRACTOR_LINK_SECRET'];
  else process.env['CONTRACTOR_LINK_SECRET'] = savedSecret;
});

describe('ContractorPortalPage', () => {
  it('shows the curated ticket + the advance step for a valid link', async () => {
    render(await ContractorPortalPage(props(token())));

    expect(screen.getByText(/RPR-2026-00042/)).toBeInTheDocument();
    expect(screen.getByText('The kitchen tap is leaking steadily.')).toBeInTheDocument();
    expect(screen.getByText('Flat 2, 14 Palatine Road')).toBeInTheDocument();
    expect(screen.getByTestId('advance-control')).toHaveTextContent('Start work');
    // PII minimisation: the reporter's contact details are NOT shown to the contractor
    expect(screen.queryByText('tess@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('07700900000')).not.toBeInTheDocument();
  });

  it('404s an invalid or expired token before any read', async () => {
    await expect(ContractorPortalPage(props('garbage'))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(ContractorPortalPage(props(token({ expiresInMs: -1 })))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('404s when the link is not for the ticket’s current assignee', async () => {
    findFirst.mockResolvedValue({ ...ticket, assignedContractorId: 'someone-else' });
    await expect(ContractorPortalPage(props(token()))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('shows a submitted-for-review note instead of a control once complete', async () => {
    findFirst.mockResolvedValue({ ...ticket, status: 'awaiting_review' });
    render(await ContractorPortalPage(props(token())));
    expect(screen.queryByTestId('advance-control')).not.toBeInTheDocument();
    expect(screen.getByText(/submitted for review/i)).toBeInTheDocument();
  });
});
