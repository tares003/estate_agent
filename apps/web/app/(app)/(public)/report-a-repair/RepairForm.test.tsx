// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; the responsive layout is the page-level Playwright e2e pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { REPAIR_CONSENT_TEXT } from './consent-text.js';

const submitRepairRequest = vi.fn();
const finalizeRepairFiles = vi.fn();
vi.mock('./actions.js', () => ({
  submitRepairRequest: (...args: unknown[]) => submitRepairRequest(...args),
  finalizeRepairFiles: (...args: unknown[]) => finalizeRepairFiles(...args),
}));

const { RepairForm } = await import('./RepairForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  submitRepairRequest.mockResolvedValue({ ok: false });
});

describe('RepairForm', () => {
  it('renders the repair fields with the verbatim consent affirmation', () => {
    render(<RepairForm />);
    expect(screen.getByLabelText(/Your name/i)).toBeRequired();
    expect(screen.getByLabelText(/Property reference or address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/What needs repairing/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Describe the problem/i)).toBeRequired();
    expect(screen.getByLabelText(/How urgent is it/i)).toBeInTheDocument();
    expect(screen.getByText(REPAIR_CONSENT_TEXT)).toBeInTheDocument();
  });

  it('shows the success confirmation with the §G.1 ticket reference', async () => {
    submitRepairRequest.mockResolvedValue({ ok: true, reference: 'RPR-2026-00042' });
    const user = userEvent.setup();
    render(<RepairForm />);

    await user.click(screen.getByRole('button', { name: /Report repair/i }));

    expect(await screen.findByText(/repair has been reported/i)).toBeInTheDocument();
    expect(screen.getByText(/RPR-2026-00042/)).toBeInTheDocument();
    expect(submitRepairRequest).toHaveBeenCalledTimes(1);
  });

  it('surfaces a field-linked error summary returned by the action', async () => {
    submitRepairRequest.mockResolvedValue({
      ok: false,
      errors: [{ field: 'email', message: 'Enter a valid email address.' }],
    });
    const user = userEvent.setup();
    render(<RepairForm />);

    await user.click(screen.getByRole('button', { name: /Report repair/i }));

    const link = await screen.findByRole('link', { name: /Enter a valid email address/i });
    expect(link).toHaveAttribute('href', '#email');
  });
});

describe('RepairForm — attachments (FR-G-2)', () => {
  it('uploads each granted file after a successful submit, then finalizes and confirms', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    submitRepairRequest.mockResolvedValue({
      ok: true,
      reference: 'RPR-2026-00042',
      repairRequestId: 'rep-1',
      uploadGrants: [{ key: 'tenants/t/repairs/rep-1/abc.jpg', token: 'tok', name: 'leak.jpg' }],
    });
    finalizeRepairFiles.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    const { container } = render(<RepairForm />);
    const file = new File([new Uint8Array([1, 2])], 'leak.jpg', { type: 'image/jpeg' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Report repair/i }));

    expect(await screen.findByText(/repair has been reported/i)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/storage/upload?token=tok');
    expect(init.method).toBe('PUT');
    expect(finalizeRepairFiles).toHaveBeenCalledWith({
      repairRequestId: 'rep-1',
      files: [
        {
          key: 'tenants/t/repairs/rep-1/abc.jpg',
          name: 'leak.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2,
        },
      ],
    });
  });

  it('declares the selected files to the submit action via the hidden metadata field', async () => {
    submitRepairRequest.mockResolvedValue({ ok: false, errors: [] });
    const user = userEvent.setup();
    const { container } = render(<RepairForm />);
    const file = new File([new Uint8Array([1, 2, 3])], 'leak.jpg', { type: 'image/jpeg' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Report repair/i }));

    const formData = submitRepairRequest.mock.calls[0]?.[1] as FormData;
    expect(JSON.parse(String(formData.get('filesMeta')))).toEqual([
      { name: 'leak.jpg', contentType: 'image/jpeg', sizeBytes: 3 },
    ]);
  });
});
