// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setRepairProperty = vi.fn();
vi.mock('./link-property-actions.js', () => ({
  setRepairProperty: (...args: unknown[]) => setRepairProperty(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { PropertyMatchControl } = await import('./PropertyMatchControl.js');

const CHOICES = [
  { id: 'p1', displayAddress: '1 Acacia Avenue' },
  { id: 'p2', displayAddress: '2 Birch Road' },
];

beforeEach(() => {
  vi.clearAllMocks();
  setRepairProperty.mockResolvedValue({ ok: false });
});

describe('PropertyMatchControl', () => {
  it('offers the tenant listings with the current match pre-selected', () => {
    render(<PropertyMatchControl repairId="r1" current="p2" choices={CHOICES} />);
    const select = screen.getByLabelText(/Matched property/i);
    expect(select).toHaveValue('p2');
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toContain('1 Acacia Avenue');
    expect(labels).toContain('Not matched');
  });

  it('submits the chosen property and refreshes on success', async () => {
    setRepairProperty.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PropertyMatchControl repairId="r1" current={null} choices={CHOICES} />);

    await user.selectOptions(screen.getByLabelText(/Matched property/i), 'p1');
    await user.click(screen.getByRole('button', { name: /Save match/i }));

    expect(setRepairProperty).toHaveBeenCalledTimes(1);
    const fd = setRepairProperty.mock.calls[0]?.[1] as FormData;
    expect(fd.get('repairId')).toBe('r1');
    expect(fd.get('propertyId')).toBe('p1');
    expect(refresh).toHaveBeenCalled();
  });
});
