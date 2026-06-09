// responsive-coverage: opt-out all — asserts the composer behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const addEnquiryNote = vi.fn();
vi.mock('../note-actions.js', () => ({
  addEnquiryNote: (...args: unknown[]) => addEnquiryNote(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { NoteComposer } = await import('./NoteComposer.js');

beforeEach(() => {
  vi.clearAllMocks();
  addEnquiryNote.mockResolvedValue({ ok: false });
});

describe('NoteComposer', () => {
  it('renders a body field and the client-visibility toggle (defaulting to internal)', () => {
    render(<NoteComposer enquiryId="e1" />);
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toBeRequired();
    const toggle = screen.getByRole('checkbox', { name: 'Visible to the client' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAttribute('value', 'false');
    expect(document.querySelector('input[name="enquiryId"]')).toHaveValue('e1');
  });

  it('submits the note and refreshes the thread on success', async () => {
    addEnquiryNote.mockResolvedValue({ ok: true, noteId: 'n1' });
    const user = userEvent.setup();
    render(<NoteComposer enquiryId="e1" />);

    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Called the buyer.');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(addEnquiryNote).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it('surfaces the action errors and does not refresh', async () => {
    addEnquiryNote.mockResolvedValue({
      ok: false,
      errors: [{ field: 'body', message: 'A note cannot be empty.' }],
    });
    const user = userEvent.setup();
    render(<NoteComposer enquiryId="e1" />);

    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('A note cannot be empty.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
