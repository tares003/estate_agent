// responsive-coverage: opt-out all — asserts the editor behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const upsertSeoMetadata = vi.fn();
vi.mock('./actions.js', () => ({
  upsertSeoMetadata: (...args: unknown[]) => upsertSeoMetadata(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { SeoMetadataEditor, emptySeoMetadataValue } = await import('./SeoMetadataEditor.js');

beforeEach(() => {
  vi.clearAllMocks();
  upsertSeoMetadata.mockResolvedValue({ ok: true });
});

describe('SeoMetadataEditor', () => {
  it('hides the entity-id field for the default scope and shows it for an entity scope', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataEditor value={emptySeoMetadataValue('default')} />);

    expect(screen.queryByLabelText(/entity id/i)).toBeNull();

    await user.selectOptions(screen.getByLabelText(/applies to/i), 'property');
    expect(screen.getByLabelText(/entity id/i)).toBeInTheDocument();
  });

  it('shows a live, polite character counter for the meta title', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataEditor value={emptySeoMetadataValue('default')} />);

    const counter = screen.getByText(/title length: 0 \/ 60/i);
    expect(counter).toHaveAttribute('aria-live', 'polite');

    await user.type(screen.getByLabelText(/meta title/i), 'Hello');
    expect(screen.getByText(/title length: 5 \/ 60/i)).toBeInTheDocument();
  });

  it('reveals the canonical URL only after opening Advanced', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataEditor value={emptySeoMetadataValue('default')} />);

    expect(screen.queryByLabelText(/canonical url/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /show advanced/i }));
    expect(screen.getByLabelText(/canonical url/i)).toBeInTheDocument();
  });

  it('submits to the upsert action and refreshes on success', async () => {
    const user = userEvent.setup();
    render(<SeoMetadataEditor value={emptySeoMetadataValue('default')} />);

    await user.type(screen.getByLabelText(/meta title/i), 'Acme Estates');
    await user.click(screen.getByRole('button', { name: /save seo settings/i }));

    await waitFor(() => expect(upsertSeoMetadata).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
