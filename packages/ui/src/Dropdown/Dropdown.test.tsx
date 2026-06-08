// responsive-coverage: opt-out all — Dropdown is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import axe from 'axe-core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dropdown, type DropdownItem } from './Dropdown.js';

const items: DropdownItem[] = [
  { id: 'edit', label: 'Edit property' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'archive', label: 'Archive' },
];

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite where the real browser renders the token colours). Structural
// a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('Dropdown', () => {
  it('renders a trigger button with the given label, collapsed by default', () => {
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The menu is not in the document while collapsed.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu on trigger click and reflects aria-expanded', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('moves focus to the first item when opened with the keyboard (Enter/Space)', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    trigger.focus();
    await user.keyboard('{Enter}');

    const menuItems = screen.getAllByRole('menuitem');
    await waitFor(() => expect(menuItems[0]).toHaveFocus());
  });

  it('opens with ArrowDown and focuses the first item', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const menuItems = screen.getAllByRole('menuitem');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => expect(menuItems[0]).toHaveFocus());
  });

  it('opens with ArrowUp and focuses the last item', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    trigger.focus();
    await user.keyboard('{ArrowUp}');

    const menuItems = screen.getAllByRole('menuitem');
    await waitFor(() => expect(menuItems[menuItems.length - 1]).toHaveFocus());
  });

  it('ArrowDown/ArrowUp move roving focus between items (with wrap)', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const menuItems = screen.getAllByRole('menuitem');
    // Click leaves focus on the first item; ArrowDown advances.
    await waitFor(() => expect(menuItems[0]).toHaveFocus());

    await user.keyboard('{ArrowDown}');
    expect(menuItems[1]).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(menuItems[2]).toHaveFocus();

    // Wrap forward from the last to the first.
    await user.keyboard('{ArrowDown}');
    expect(menuItems[0]).toHaveFocus();

    // Wrap backward from the first to the last.
    await user.keyboard('{ArrowUp}');
    expect(menuItems[2]).toHaveFocus();
  });

  it('Home jumps to the first item and End to the last', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const menuItems = screen.getAllByRole('menuitem');
    await waitFor(() => expect(menuItems[0]).toHaveFocus());

    await user.keyboard('{End}');
    expect(menuItems[2]).toHaveFocus();

    await user.keyboard('{Home}');
    expect(menuItems[0]).toHaveFocus();
  });

  it('the focused item is the only one in the tab order (roving tabindex)', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const menuItems = screen.getAllByRole('menuitem');
    await waitFor(() => expect(menuItems[0]).toHaveFocus());

    expect(menuItems[0]).toHaveAttribute('tabindex', '0');
    expect(menuItems[1]).toHaveAttribute('tabindex', '-1');
    expect(menuItems[2]).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowDown}');
    expect(menuItems[0]).toHaveAttribute('tabindex', '-1');
    expect(menuItems[1]).toHaveAttribute('tabindex', '0');
  });

  it('Enter activates the focused item: fires onSelect and closes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger="Actions"
        items={[{ id: 'edit', label: 'Edit property', onSelect }, ...items.slice(1)]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await user.click(trigger);

    await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Focus returns to the trigger after activation.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('Space activates the focused item', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger="Actions"
        items={[{ id: 'edit', label: 'Edit property', onSelect }, ...items.slice(1)]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());

    await user.keyboard(' ');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a mouse click on an item fires onSelect and closes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger="Actions"
        items={[items[0]!, { id: 'duplicate', label: 'Duplicate', onSelect }, items[2]!]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await user.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('an outside click closes the menu', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Dropdown trigger="Actions" items={items} />
        <button type="button">Elsewhere</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('clicking the trigger again closes the menu (toggle)', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(trigger);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('a disabled item is marked disabled and is not actionable', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger="Actions"
        items={[
          { id: 'edit', label: 'Edit property' },
          { id: 'archive', label: 'Archive', onSelect, disabled: true },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const archive = screen.getByRole('menuitem', { name: 'Archive' });
    expect(archive).toHaveAttribute('aria-disabled', 'true');

    await user.click(archive);
    expect(onSelect).not.toHaveBeenCalled();
    // The menu stays open because nothing was activated.
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('roving focus skips disabled items during arrow navigation', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger="Actions"
        items={[
          { id: 'edit', label: 'Edit property' },
          { id: 'duplicate', label: 'Duplicate', disabled: true },
          { id: 'archive', label: 'Archive' },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const edit = screen.getByRole('menuitem', { name: 'Edit property' });
    const archive = screen.getByRole('menuitem', { name: 'Archive' });
    await waitFor(() => expect(edit).toHaveFocus());

    // ArrowDown skips the disabled "Duplicate" and lands on "Archive".
    await user.keyboard('{ArrowDown}');
    expect(archive).toHaveFocus();
  });

  it('renders link items as anchors with the given href', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger="Account"
        items={[
          { id: 'profile', label: 'Profile', href: '/profile' },
          { id: 'signout', label: 'Sign out' },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Account' }));

    const profile = screen.getByRole('menuitem', { name: 'Profile' });
    expect(profile.tagName).toBe('A');
    expect(profile).toHaveAttribute('href', '/profile');
  });

  it('applies the alignment modifier class to the menu', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} align="end" />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu')).toHaveClass('align-end');
  });

  it('defaults alignment to start', async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger="Actions" items={items} />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu')).toHaveClass('align-start');
  });

  it('has no detectable axe-core accessibility violations when closed', async () => {
    const { container } = render(<Dropdown trigger="Actions" items={items} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Dropdown
        trigger="Actions"
        items={[
          { id: 'edit', label: 'Edit property' },
          { id: 'duplicate', label: 'Duplicate', href: '/dup' },
          { id: 'archive', label: 'Archive', disabled: true },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
