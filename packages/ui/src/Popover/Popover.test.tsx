// responsive-coverage: opt-out all — Popover is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests.
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Popover } from './Popover.js';

// The Popover panel renders through createPortal to document.body. RTL's
// automatic cleanup unmounts the React tree between cases, tearing the portal
// down — so no manual document.body reset is needed.

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('Popover', () => {
  it('renders the trigger and keeps the panel closed by default', () => {
    render(
      <Popover trigger="Filters">
        <p>Panel body</p>
      </Popover>,
    );
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
  });

  it('marks the trigger with the popover ARIA wiring', () => {
    render(
      <Popover trigger="Filters">
        <p>Panel body</p>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // aria-controls always points at the panel id (the relationship is stable)
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();
  });

  it('opens on trigger click and reflects aria-expanded', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <p>Panel body</p>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    // the trigger controls the now-rendered panel
    expect(trigger.getAttribute('aria-controls')).toBe(screen.getByRole('dialog').id);
  });

  it('toggles closed on a second trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <p>Panel body</p>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives the panel an accessible name from the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <p>Panel body</p>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Filters');
  });

  it('closes when Escape is pressed and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <button type="button">Inside action</button>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popover trigger="Filters">
          <p>Panel body</p>
        </Popover>
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not close when clicking inside the panel', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <button type="button">Inside action</button>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Inside action' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('moves focus into the panel on open', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <button type="button">Inside action</button>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('accepts a render-function trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover
        trigger={(props) => (
          <button type="button" {...props}>
            Open menu
          </button>
        )}
      >
        <p>Panel body</p>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('honours defaultOpen (uncontrolled) and reports changes via onOpenChange', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters" defaultOpen onOpenChange={onOpenChange}>
        <p>Panel body</p>
      </Popover>,
    );
    // starts open from defaultOpen
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is fully controlled when `open` is supplied', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    function Harness(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          trigger="Filters"
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <p>Panel body</p>
        </Popover>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not change its own state in controlled mode if the parent ignores onOpenChange', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters" open={false} onOpenChange={vi.fn()}>
        <p>Panel body</p>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    // parent kept open=false, so the panel must remain closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies the side modifier class to the panel', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters" side="top">
        <p>Panel body</p>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog')).toHaveClass('top');
  });

  it('defaults the side modifier class to bottom', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Filters">
        <p>Panel body</p>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog')).toHaveClass('bottom');
  });

  it('has no detectable axe-core accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Popover trigger="Filters">
        <button type="button">Inside action</button>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));

    // assert on the whole document so the portalled panel + the trigger are both
    // covered; the trigger lives in `container`, the panel in document.body
    const triggerResults = await axe.run(container, axeOptions);
    expect(triggerResults.violations).toEqual([]);
    const panelResults = await axe.run(screen.getByRole('dialog'), axeOptions);
    expect(panelResults.violations).toEqual([]);
  });
});
