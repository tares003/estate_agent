// responsive-coverage: opt-out all — asserts the checklist + override behaviour;
// the §H.5 Tab 9 right-rail layout is covered by the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const publishWithPreflight = vi.fn();
vi.mock('./publish-preflight-actions.js', () => ({
  publishWithPreflight: (...args: unknown[]) => publishWithPreflight(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { PublishPreflight } = await import('./PublishPreflight.js');

const ALL_GREEN = [
  { key: 'photos', label: 'At least 5 photos', satisfied: true },
  { key: 'mainImage', label: 'Main image set', satisfied: true },
] as const;

const HAS_RED = [
  { key: 'photos', label: 'At least 5 photos', satisfied: false },
  { key: 'mainImage', label: 'Main image set', satisfied: true },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  publishWithPreflight.mockResolvedValue({ ok: false });
});

describe('PublishPreflight', () => {
  it('renders each checklist item with its satisfied state (FR-F-8 / §H.5 Tab 9)', () => {
    render(<PublishPreflight propertyId="p1" items={[...HAS_RED]} ready={false} />);
    expect(screen.getByText('At least 5 photos')).toBeInTheDocument();
    expect(screen.getByText('Main image set')).toBeInTheDocument();
    // the unmet item is flagged for assistive tech
    const photos = screen.getByText('At least 5 photos').closest('li');
    expect(photos).toHaveAttribute('data-satisfied', 'false');
  });

  it('enables a plain Publish (no override) when every item is green', () => {
    render(<PublishPreflight propertyId="p1" items={[...ALL_GREEN]} ready />);
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
    // no override reason field is shown when ready
    expect(screen.queryByLabelText(/reason/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="override"]')).toHaveValue('false');
  });

  it('requires a typed reason to override when the checklist has a red item', () => {
    render(<PublishPreflight propertyId="p1" items={[...HAS_RED]} ready={false} />);
    expect(screen.getByRole('button', { name: /override and publish/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    expect(document.querySelector('input[name="override"]')).toHaveValue('true');
  });

  it('refreshes the route on a successful publish', async () => {
    publishWithPreflight.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PublishPreflight propertyId="p1" items={[...ALL_GREEN]} ready />);

    await user.click(screen.getByRole('button', { name: /publish/i }));

    expect(publishWithPreflight).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });
});
