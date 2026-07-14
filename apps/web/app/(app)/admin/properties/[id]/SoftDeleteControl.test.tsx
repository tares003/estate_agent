// responsive-coverage: opt-out all — asserts the control behaviour (the confirm
// step); layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const softDeleteProperty = vi.fn();
vi.mock('./soft-delete-actions.js', () => ({
  softDeleteProperty: (...args: unknown[]) => softDeleteProperty(...args),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const { SoftDeleteControl } = await import('./SoftDeleteControl.js');

beforeEach(() => {
  vi.clearAllMocks();
  softDeleteProperty.mockResolvedValue({ ok: false });
});

describe('SoftDeleteControl', () => {
  it('offers Delete listing without submitting anything', () => {
    render(<SoftDeleteControl propertyId="p1" />);
    expect(screen.getByRole('button', { name: 'Delete listing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument();
    expect(softDeleteProperty).not.toHaveBeenCalled();
  });

  it('requires a confirm step — the first click only reveals Confirm delete + Cancel', async () => {
    const user = userEvent.setup();
    render(<SoftDeleteControl propertyId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Delete listing' }));

    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).toHaveValue('p1');
    expect(softDeleteProperty).not.toHaveBeenCalled();
  });

  it('backs out of the confirm step on Cancel without deleting', async () => {
    const user = userEvent.setup();
    render(<SoftDeleteControl propertyId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Delete listing' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Delete listing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument();
    expect(softDeleteProperty).not.toHaveBeenCalled();
  });

  it('submits the action on Confirm delete and returns to the catalogue on success', async () => {
    softDeleteProperty.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SoftDeleteControl propertyId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Delete listing' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(softDeleteProperty).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/admin/properties');
  });
});
