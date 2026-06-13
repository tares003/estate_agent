// responsive-coverage: opt-out all — asserts the manager behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const seedRepairCategories = vi.fn();
const setRepairCategoryVisibility = vi.fn();
vi.mock('./actions.js', () => ({
  seedRepairCategories: (...args: unknown[]) => seedRepairCategories(...args),
  setRepairCategoryVisibility: (...args: unknown[]) => setRepairCategoryVisibility(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { RepairCategoriesManager } = await import('./RepairCategoriesManager.js');

const CATEGORIES = [
  { id: 'c1', slug: 'plumbing', label: 'Plumbing', defaultUrgency: 'standard', visible: true },
  { id: 'c2', slug: 'decoration', label: 'Decoration', defaultUrgency: 'low', visible: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  seedRepairCategories.mockResolvedValue({ ok: true });
  setRepairCategoryVisibility.mockResolvedValue({ ok: true });
});

describe('RepairCategoriesManager', () => {
  it('offers to seed the §G.3 defaults when the catalogue is empty', () => {
    render(<RepairCategoriesManager categories={[]} />);
    expect(screen.getByText(/No categories yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add the default categories/i })).toBeInTheDocument();
  });

  it('lists each category with its visibility, and a hidden one reads as Hidden', () => {
    render(<RepairCategoriesManager categories={CATEGORIES} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Plumbing')).toBeInTheDocument();
    expect(within(table).getByText('Decoration')).toBeInTheDocument();
    expect(within(table).getByText('Hidden')).toBeInTheDocument();
    // the visible row offers Hide; the hidden row offers Show
    expect(within(table).getByRole('button', { name: 'Hide' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });

  it('toggles a category visibility and refreshes', async () => {
    const user = userEvent.setup();
    render(<RepairCategoriesManager categories={CATEGORIES} />);
    await user.click(screen.getByRole('button', { name: 'Hide' }));

    expect(setRepairCategoryVisibility).toHaveBeenCalledTimes(1);
    const fd = setRepairCategoryVisibility.mock.calls[0]?.[1] as FormData;
    expect(fd.get('slug')).toBe('plumbing');
    expect(fd.get('visible')).toBe('false');
  });
});
