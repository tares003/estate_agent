// responsive-coverage: opt-out all — asserts the upload form, the dry-run preview step
// and the result rendering; layout is the admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ImportActionState } from './actions.js';
import type { ImportPreviewState } from './preview-action.js';

// The form runs a two-step state machine: it first posts the upload to the DRY-RUN
// `previewPropertyImport` action (no writes), shows the preview, and only on "Confirm and
// import" posts the same file to the audited `importPropertiesFromCsv` action. We drive
// both `useActionState` hooks off scripted states: the FIRST hook the component reads is
// the preview hook, the SECOND is the import hook (call order is stable within a render).
let previewState: ImportPreviewState = { ok: false };
let importState: ImportActionState = { ok: false };
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  let call = 0;
  const useActionState = () => {
    const isPreviewHook = call % 2 === 0;
    call += 1;
    return isPreviewHook
      ? ([previewState, vi.fn(), false] as const)
      : ([importState, vi.fn(), false] as const);
  };
  return { ...actual, useActionState };
});

vi.mock('./actions.js', () => ({ importPropertiesFromCsv: vi.fn() }));
vi.mock('./preview-action.js', () => ({ previewPropertyImport: vi.fn() }));

const { PropertyImportForm } = await import('./PropertyImportForm.js');

const CLEAN_PREVIEW: ImportPreviewState = {
  ok: true,
  preview: {
    counts: { input: 2, valid: 2, invalid: 0 },
    sample: [
      {
        reference: 'REF-001',
        displayAddress: '12 Acacia Ave',
        price: null,
        listingType: 'residential',
      },
      {
        reference: 'REF-002',
        displayAddress: '14 Acacia Ave',
        price: null,
        listingType: 'residential',
      },
    ],
    errors: [],
    recognisedColumns: ['reference', 'postcode'],
    ignoredColumns: [],
    detectedPreset: null,
  },
};

/** A preview whose upload was recognised as a Reapit export (a CRM was detected). */
const REAPIT_PREVIEW: ImportPreviewState = {
  ok: true,
  preview: {
    counts: { input: 1, valid: 0, invalid: 1 },
    sample: [],
    errors: ['Row 1 — postcode: Enter a valid UK postcode.'],
    recognisedColumns: [],
    ignoredColumns: [
      'Agency Reference',
      'Postcode',
      'Property Type',
      'Sale/Let',
      'Display Address',
    ],
    detectedPreset: 'reapit',
  },
};

beforeEach(() => {
  previewState = { ok: false };
  importState = { ok: false };
});

describe('PropertyImportForm', () => {
  it('renders a file input and a preview button before any run', () => {
    render(<PropertyImportForm />);
    expect(screen.getByLabelText(/property csv/i)).toBeTruthy();
    // The primary action previews (dry run) first — it does not import outright.
    expect(screen.getByRole('button', { name: /preview import/i })).toBeTruthy();
    // No "confirm and import" until a preview exists.
    expect(screen.queryByRole('button', { name: /confirm and import/i })).toBeNull();
  });

  it('documents the expected CSV columns', () => {
    render(<PropertyImportForm />);
    expect(screen.getAllByText('reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('postcode').length).toBeGreaterThan(0);
  });

  it('shows the dry-run preview counts and a sample after a preview', () => {
    previewState = CLEAN_PREVIEW;
    render(<PropertyImportForm />);
    // A clear "dry-run preview" heading distinguishes it from a completed import.
    expect(screen.getByRole('heading', { name: /dry-run preview/i })).toBeTruthy();
    const counts = screen.getByLabelText(/preview counts/i);
    expect(counts.textContent).toContain('2'); // valid
    // The mapped sample surfaces the first records' references.
    expect(screen.getByText('REF-001')).toBeTruthy();
    expect(screen.getByText('REF-002')).toBeTruthy();
  });

  it('offers confirm and cancel once a preview is shown', () => {
    previewState = CLEAN_PREVIEW;
    render(<PropertyImportForm />);
    expect(screen.getByRole('button', { name: /confirm and import/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });

  it('lists the per-row preview errors for an invalid file', () => {
    previewState = {
      ok: true,
      preview: {
        counts: { input: 1, valid: 0, invalid: 1 },
        sample: [],
        errors: ['Row 1 — postcode: Enter a valid UK postcode.'],
        recognisedColumns: ['reference'],
        ignoredColumns: [],
        detectedPreset: null,
      },
    };
    render(<PropertyImportForm />);
    expect(screen.getByText(/Row 1 — postcode/)).toBeTruthy();
  });

  it('surfaces a preview denial / validation error', () => {
    previewState = {
      ok: false,
      errors: [{ message: 'You do not have permission to import listings.' }],
    };
    render(<PropertyImportForm />);
    expect(screen.getByText(/do not have permission/i)).toBeTruthy();
  });

  it('cancels the preview and returns to the upload step', () => {
    previewState = CLEAN_PREVIEW;
    render(<PropertyImportForm />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // After cancelling, the preview UI is gone and the file input is back.
    expect(screen.queryByRole('button', { name: /confirm and import/i })).toBeNull();
    expect(screen.getByRole('button', { name: /preview import/i })).toBeTruthy();
  });

  it('shows the final import result after a confirmed run', () => {
    importState = {
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

  it('shows the column-mapping editor once a preview is available (FR-X-3)', () => {
    previewState = CLEAN_PREVIEW;
    render(<PropertyImportForm />);
    // The mapping editor lets the admin adjust the mapping and re-preview.
    expect(screen.getByRole('heading', { name: /map your columns/i })).toBeTruthy();
    // A re-preview action is offered so a changed mapping can be validated again.
    expect(screen.getByRole('button', { name: /re-?preview|preview import/i })).toBeTruthy();
  });

  it('announces the auto-detected CRM preset (FR-X-3)', () => {
    previewState = REAPIT_PREVIEW;
    render(<PropertyImportForm />);
    // The detected preset is surfaced to the admin in a "Detected a … export" notice.
    expect(screen.getByText(/detected a/i)).toBeTruthy();
    expect(screen.getByText(/detected a/i).textContent?.toLowerCase()).toContain('reapit');
  });

  it('carries the chosen mapping to the actions via a hidden field (FR-X-3)', () => {
    previewState = CLEAN_PREVIEW;
    const { container } = render(<PropertyImportForm />);
    // A hidden `mapping` input travels with the file to both the preview and import
    // actions, so the confirmed run parses identically to the preview.
    const hidden = container.querySelector('input[name="mapping"]');
    expect(hidden).not.toBeNull();
  });

  it('lists the per-row error summary after a confirmed run with failures', () => {
    importState = {
      ok: true,
      importLogId: 'log-1',
      counts: { input: 1, created: 0, skipped: 0, failed: 1 },
      errorSummary: ['Row 1 — postcode: Enter a valid UK postcode.'],
    };
    render(<PropertyImportForm />);
    expect(screen.getByText(/Row 1 — postcode/)).toBeTruthy();
  });
});
