// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setPropertyPublished = vi.fn();
vi.mock('./publish-actions.js', () => ({
  setPropertyPublished: (...args: unknown[]) => setPropertyPublished(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { PublishControl } = await import('./PublishControl.js');

beforeEach(() => {
  vi.clearAllMocks();
  setPropertyPublished.mockResolvedValue({ ok: false });
});

describe('PublishControl', () => {
  it('offers Publish for a draft (submitting publish=true)', () => {
    render(<PublishControl propertyId="p1" published={false} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(document.querySelector('input[name="publish"]')).toHaveValue('true');
    expect(document.querySelector('input[name="id"]')).toHaveValue('p1');
  });

  it('offers Unpublish for a live listing (submitting publish=false)', () => {
    render(<PublishControl propertyId="p1" published />);
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(document.querySelector('input[name="publish"]')).toHaveValue('false');
  });

  it('refreshes on success', async () => {
    setPropertyPublished.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PublishControl propertyId="p1" published={false} />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(setPropertyPublished).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });
});
