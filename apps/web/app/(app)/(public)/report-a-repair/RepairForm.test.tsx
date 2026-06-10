// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; the responsive layout is the page-level Playwright e2e pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { REPAIR_CONSENT_TEXT } from './consent-text.js';

const submitRepairRequest = vi.fn();
vi.mock('./actions.js', () => ({
  submitRepairRequest: (...args: unknown[]) => submitRepairRequest(...args),
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

  it('shows the success confirmation after a successful submit', async () => {
    submitRepairRequest.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RepairForm />);

    await user.click(screen.getByRole('button', { name: /Report repair/i }));

    expect(await screen.findByText(/repair has been reported/i)).toBeInTheDocument();
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
