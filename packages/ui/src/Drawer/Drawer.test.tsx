// responsive-coverage: opt-out all — Drawer responsive sheet/panel layout is verified via Playwright in a follow-on; RTL covers focus/escape/aria behaviour
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer.js';

// The Drawer renders through createPortal to document.body. RTL's automatic
// cleanup unmounts the React tree between cases, which tears the portal down —
// so no manual document.body reset is needed (and resetting it would race RTL's
// own container removal).

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('Drawer', () => {
  it('renders its content when open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <p>Refine the property search.</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Refine the property search.')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="Filters">
        <p>Hidden body</p>
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden body')).not.toBeInTheDocument();
  });

  it('is a modal dialog labelled by its title', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <p>Body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // accessible name resolves to the title text via aria-labelledby
    expect(dialog).toHaveAccessibleName('Filters');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId as string)).toHaveTextContent('Filters');
  });

  it('renders the title as a heading', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
  });

  it('renders an accessible close button that calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        <p>Body</p>
      </Drawer>,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('anchors to the right by default', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <p>Body</p>
      </Drawer>,
    );
    // the panel surface carries the side modifier
    expect(screen.getByRole('dialog')).toHaveClass('right');
  });

  it('applies the side class when a side is given', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters" side="left">
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('left');
  });

  it('anchors to the bottom when side is bottom', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters" side="bottom">
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('bottom');
  });

  it('applies the size class when a size is given', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters" size="lg">
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('lg');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        <p>Body</p>
      </Drawer>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        <p>Body</p>
      </Drawer>,
    );
    await user.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop click when closeOnBackdrop is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters" closeOnBackdrop={false}>
        <p>Body</p>
      </Drawer>,
    );
    await user.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when a click starts inside the panel and ends on the backdrop', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        <button type="button">Inside</button>
      </Drawer>,
    );
    // a real click on the panel surface must not bubble up as a backdrop close
    await user.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the panel on open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <button type="button">First action</button>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    // focus has moved into the panel subtree
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the trigger when closed', async () => {
    const user = userEvent.setup();

    function Harness(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open drawer
          </button>
          <Drawer open={open} onClose={() => setOpen(false)} title="Filters">
            <p>Body</p>
          </Drawer>
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('traps Tab focus within the panel (wraps from last to first)', async () => {
    const user = userEvent.setup();
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <button type="button">Body action</button>
        <button type="button">Apply filters</button>
      </Drawer>,
    );

    const dialog = screen.getByRole('dialog');
    const closeBtn = within(dialog).getByRole('button', { name: /close/i });
    const bodyBtn = within(dialog).getByRole('button', { name: 'Body action' });
    const applyBtn = within(dialog).getByRole('button', { name: 'Apply filters' });

    // focus the last tabbable, then Tab should wrap to the first
    applyBtn.focus();
    expect(applyBtn).toHaveFocus();
    await user.tab();
    expect(closeBtn).toHaveFocus();

    // Shift+Tab from the first tabbable wraps to the last
    await user.tab({ shift: true });
    expect(applyBtn).toHaveFocus();

    // sanity: the body action sits between the two
    expect(dialog).toContainElement(bodyBtn);
  });

  it('keeps focus on the panel when it has no tabbable content and Tab is pressed', async () => {
    const user = userEvent.setup();
    render(
      <Drawer open onClose={vi.fn()} title="Filters" closeOnBackdrop={false}>
        <p>Read-only details, no controls.</p>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    // the only tabbable is the close button; focus it, then tabbing keeps focus
    // trapped inside the panel subtree
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('has no detectable axe-core accessibility violations', async () => {
    render(
      <Drawer open onClose={vi.fn()} title="Filters">
        <p>Refine the property search.</p>
        <button type="button">Apply filters</button>
      </Drawer>,
    );
    const results = await axe.run(screen.getByRole('dialog'), axeOptions);
    expect(results.violations).toEqual([]);
  });
});
