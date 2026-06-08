// responsive-coverage: opt-out all — Modal responsive layout (mobile sheet vs desktop dialog) is verified via Playwright visual-regression (pending wave-5); RTL covers focus/escape/aria behaviour
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal.js';

// The Modal renders through createPortal to document.body. RTL's automatic
// cleanup unmounts the React tree between cases, which tears the portal down —
// so no manual document.body reset is needed (and resetting it would race RTL's
// own container removal).

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('Modal', () => {
  it('renders its content when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Contact agent">
        <p>Send a message about Palatine Road.</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Send a message about Palatine Road.')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Contact agent">
        <p>Hidden body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden body')).not.toBeInTheDocument();
  });

  it('is a modal dialog labelled by its title', () => {
    render(
      <Modal open onClose={vi.fn()} title="Contact agent">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // accessible name resolves to the title text via aria-labelledby
    expect(dialog).toHaveAccessibleName('Contact agent');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId as string)).toHaveTextContent('Contact agent');
  });

  it('renders the title as a heading', () => {
    render(
      <Modal open onClose={vi.fn()} title="Contact agent">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole('heading', { name: 'Contact agent' })).toBeInTheDocument();
  });

  it('renders an accessible close button that calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Contact agent">
        <p>Body</p>
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a footer when provided', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Contact agent"
        footer={<button type="button">Send message</button>}
      >
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
  });

  it('applies the size class when a size is given', () => {
    render(
      <Modal open onClose={vi.fn()} title="Contact agent" size="lg">
        <p>Body</p>
      </Modal>,
    );
    // the dialog surface carries the size modifier
    expect(screen.getByRole('dialog')).toHaveClass('lg');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Contact agent">
        <p>Body</p>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Contact agent">
        <p>Body</p>
      </Modal>,
    );
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop click when closeOnBackdrop is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Contact agent" closeOnBackdrop={false}>
        <p>Body</p>
      </Modal>,
    );
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when a click starts inside the dialog and ends on the backdrop', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Contact agent">
        <button type="button">Inside</button>
      </Modal>,
    );
    // a real click on the dialog surface must not bubble up as a backdrop close
    await user.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog on open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Contact agent">
        <button type="button">First action</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    // focus has moved into the dialog subtree
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the trigger when closed', async () => {
    const user = userEvent.setup();

    function Harness(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Contact agent">
            <p>Body</p>
          </Modal>
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('traps Tab focus within the dialog (wraps from last to first)', async () => {
    const user = userEvent.setup();
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Contact agent"
        footer={<button type="button">Send message</button>}
      >
        <button type="button">Body action</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const closeBtn = within(dialog).getByRole('button', { name: /close/i });
    const bodyBtn = within(dialog).getByRole('button', { name: 'Body action' });
    const sendBtn = within(dialog).getByRole('button', { name: 'Send message' });

    // focus the last tabbable, then Tab should wrap to the first
    sendBtn.focus();
    expect(sendBtn).toHaveFocus();
    await user.tab();
    expect(closeBtn).toHaveFocus();

    // Shift+Tab from the first tabbable wraps to the last
    await user.tab({ shift: true });
    expect(sendBtn).toHaveFocus();

    // sanity: the body action sits between the two
    expect(dialog).toContainElement(bodyBtn);
  });

  it('has no detectable axe-core accessibility violations', async () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Contact agent"
        footer={<button type="button">Send message</button>}
      >
        <p>Send a message about Palatine Road.</p>
      </Modal>,
    );
    const results = await axe.run(screen.getByRole('dialog'), axeOptions);
    expect(results.violations).toEqual([]);
  });
});
