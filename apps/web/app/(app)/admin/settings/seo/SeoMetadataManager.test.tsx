// responsive-coverage: opt-out all — asserts the manager/list behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const upsertSeoMetadata = vi.fn();
const deleteSeoMetadata = vi.fn();
vi.mock('./actions.js', () => ({
  upsertSeoMetadata: (...args: unknown[]) => upsertSeoMetadata(...args),
  deleteSeoMetadata: (...args: unknown[]) => deleteSeoMetadata(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { SeoMetadataManager } = await import('./SeoMetadataManager.js');

const ROW = {
  id: 'm1',
  scope: 'property',
  scopeId: '22222222-2222-2222-2222-222222222222',
  metaTitle: 'A bright family home',
  metaDescription: 'Moments from the village.',
  canonicalUrl: null,
  ogImage: null,
  noIndex: false,
  noFollow: false,
  structuredData: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  upsertSeoMetadata.mockResolvedValue({ ok: true });
  deleteSeoMetadata.mockResolvedValue({ ok: true });
});

describe('SeoMetadataManager', () => {
  it('renders the empty state when there are no overrides', () => {
    render(<SeoMetadataManager rows={[]} />);
    expect(screen.getByText(/no seo overrides yet/i)).toBeInTheDocument();
  });

  it('lists each override with its scope and title', () => {
    render(<SeoMetadataManager rows={[ROW]} />);
    expect(screen.getByText('Property')).toBeInTheDocument();
    expect(screen.getByText('A bright family home')).toBeInTheDocument();
  });

  it('opens a blank editor when Add an override is clicked', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataManager rows={[]} />);
    await user.click(screen.getByRole('button', { name: /add an override/i }));
    expect(screen.getByLabelText(/applies to/i)).toBeInTheDocument();
  });

  it('swaps a row to the inline editor when Edit is clicked', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataManager rows={[ROW]} />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText(/meta title/i)).toHaveValue('A bright family home');
  });

  it('posts to the delete action and refreshes on success', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataManager rows={[ROW]} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteSeoMetadata).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
