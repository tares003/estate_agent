// responsive-coverage: opt-out all — asserts the table/control behaviour; layout is
// the admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createRedirect = vi.fn();
const updateRedirect = vi.fn();
const deleteRedirect = vi.fn();
vi.mock('./actions.js', () => ({
  createRedirect: (...args: unknown[]) => createRedirect(...args),
  updateRedirect: (...args: unknown[]) => updateRedirect(...args),
  deleteRedirect: (...args: unknown[]) => deleteRedirect(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { RedirectRulesTable } = await import('./RedirectRulesTable.js');

const ROW = {
  id: 'r1',
  sourcePath: '/old-page',
  destinationPath: '/new-page',
  type: 'r301',
  hitCount: 4,
  lastHitAt: null,
};

/** The add-rule form (always present at the top of the table). */
function addForm(): HTMLElement {
  return screen.getByRole('button', { name: 'Add redirect' }).closest('form') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  createRedirect.mockResolvedValue({ ok: true });
  updateRedirect.mockResolvedValue({ ok: true });
  deleteRedirect.mockResolvedValue({ ok: true });
});

describe('RedirectRulesTable', () => {
  it('shows an empty state when there are no rules', () => {
    render(<RedirectRulesTable rows={[]} />);
    expect(screen.getByText(/no redirects yet/i)).toBeInTheDocument();
  });

  it('lists a rule with its from/to paths, type label and hit count', () => {
    render(<RedirectRulesTable rows={[ROW]} />);
    const row = screen.getByText('/old-page').closest('tr') as HTMLElement;
    expect(within(row).getByText('/new-page')).toBeInTheDocument();
    expect(within(row).getByText('301 — permanent')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
  });

  it('adds a rule — submits the from/to paths and type, then refreshes', async () => {
    const user = userEvent.setup();
    render(<RedirectRulesTable rows={[]} />);
    const form = addForm();

    await user.type(within(form).getByLabelText(/From path/), '/from');
    await user.type(within(form).getByLabelText(/To path/), '/to');
    await user.click(screen.getByRole('button', { name: 'Add redirect' }));

    expect(createRedirect).toHaveBeenCalledTimes(1);
    const fd = createRedirect.mock.calls[0]?.[1] as FormData;
    expect(fd.get('sourcePath')).toBe('/from');
    expect(fd.get('destinationPath')).toBe('/to');
    expect(fd.get('type')).toBe('r301');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('reveals the edit form seeded with the rule values', async () => {
    const user = userEvent.setup();
    render(<RedirectRulesTable rows={[ROW]} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const editForm = screen
      .getByRole('button', { name: 'Save changes' })
      .closest('form') as HTMLElement;
    const source = within(editForm).getByLabelText(/From path/) as HTMLInputElement;
    expect(source.value).toBe('/old-page');
    expect(updateRedirect).not.toHaveBeenCalled();
  });

  it('edits a rule — submits the id and changed values', async () => {
    const user = userEvent.setup();
    render(<RedirectRulesTable rows={[ROW]} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const editForm = screen
      .getByRole('button', { name: 'Save changes' })
      .closest('form') as HTMLElement;
    const destination = within(editForm).getByLabelText(/To path/);
    await user.clear(destination);
    await user.type(destination, '/newer-page');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateRedirect).toHaveBeenCalledTimes(1);
    const fd = updateRedirect.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('r1');
    expect(fd.get('destinationPath')).toBe('/newer-page');
  });

  it('deletes a rule — submits the id, then refreshes', async () => {
    const user = userEvent.setup();
    render(<RedirectRulesTable rows={[ROW]} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteRedirect).toHaveBeenCalledTimes(1);
    const fd = deleteRedirect.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('r1');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('surfaces a field-linked error returned by the add action', async () => {
    createRedirect.mockResolvedValue({
      ok: false,
      errors: [{ field: 'sourcePath', message: 'The from-path must start with “/”.' }],
    });
    const user = userEvent.setup();
    render(<RedirectRulesTable rows={[]} />);
    const form = addForm();

    await user.type(within(form).getByLabelText(/From path/), 'bad');
    await user.type(within(form).getByLabelText(/To path/), '/to');
    await user.click(screen.getByRole('button', { name: 'Add redirect' }));

    expect(await screen.findByText('The from-path must start with “/”.')).toBeInTheDocument();
  });
});
