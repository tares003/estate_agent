// responsive-coverage: opt-out all — asserts the upload form + result rendering; layout
// is the admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { ImportActionState } from './actions.js';

// Drive the component off a scripted useActionState so we can assert both the initial
// upload UI and the post-run result summary without invoking the server action.
let mockState: ImportActionState = { ok: false };
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () => [mockState, vi.fn(), false] as const,
  };
});

vi.mock('./actions.js', () => ({ importPropertiesFromCsv: vi.fn() }));

const { PropertyImportForm } = await import('./PropertyImportForm.js');

beforeEach(() => {
  mockState = { ok: false };
});

describe('PropertyImportForm', () => {
  it('renders a file input and an import button before any run', () => {
    render(<PropertyImportForm />);
    expect(screen.getByLabelText(/property csv/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /import properties/i })).toBeTruthy();
  });

  it('documents the expected CSV columns', () => {
    render(<PropertyImportForm />);
    // The required field names appear as column badges in the help disclosure.
    expect(screen.getAllByText('reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('postcode').length).toBeGreaterThan(0);
  });

  it('shows the created / skipped / failed counts after a successful run', () => {
    mockState = {
      ok: true,
      importLogId: 'log-1',
      counts: { input: 3, created: 2, skipped: 0, failed: 1 },
      errorSummary: ['Row 3 — postcode: Enter a valid UK postcode.'],
    };
    render(<PropertyImportForm />);
    expect(screen.getByText(/import complete/i)).toBeTruthy();
    const counts = screen.getByLabelText(/import counts/i);
    expect(counts.textContent).toContain('2'); // created
    expect(counts.textContent).toContain('1'); // failed
  });

  it('lists the per-row error summary after a run with failures', () => {
    mockState = {
      ok: true,
      importLogId: 'log-1',
      counts: { input: 1, created: 0, skipped: 0, failed: 1 },
      errorSummary: ['Row 1 — postcode: Enter a valid UK postcode.'],
    };
    render(<PropertyImportForm />);
    expect(screen.getByText(/Row 1 — postcode/)).toBeTruthy();
  });

  it('surfaces a denial / validation error', () => {
    mockState = {
      ok: false,
      errors: [{ message: 'You do not have permission to import listings.' }],
    };
    render(<PropertyImportForm />);
    expect(screen.getByText(/do not have permission/i)).toBeTruthy();
  });
});
