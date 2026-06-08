// responsive-coverage: opt-out all — Tabs is a fluid, viewport-invariant
// composite (the tablist reflows with its container; there is no breakpoint-
// specific layout). Structural a11y, aria wiring, roving tabindex and arrow-key
// navigation are verified here in jsdom; any visual coverage composes through
// the surfaces that embed it.
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs, type TabItem } from './Tabs.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', content: <p>Property overview</p> },
  { id: 'floorplan', label: 'Floor plan', content: <p>Floor plan detail</p> },
  { id: 'location', label: 'Location', content: <p>Location and travel</p> },
];

describe('Tabs', () => {
  it('renders a tablist with a tab per item', () => {
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const list = screen.getByRole('tablist', { name: 'Property detail' });
    expect(list).toBeInTheDocument();
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Floor plan', 'Location']);
  });

  it('renders each tab as a real <button> of type button', () => {
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const tab = screen.getByRole('tab', { name: 'Overview' });
    expect(tab.tagName).toBe('BUTTON');
    expect(tab).toHaveAttribute('type', 'button');
  });

  it('selects the first tab by default and shows its panel', () => {
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const first = screen.getByRole('tab', { name: 'Overview' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Property overview');
    // only one panel is rendered (the active one)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('honours defaultActiveId for the initial uncontrolled selection', () => {
    render(<Tabs tabs={TABS} defaultActiveId="location" aria-label="Property detail" />);
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Location and travel');
  });

  it('falls back to the first tab when defaultActiveId does not match any tab', () => {
    render(<Tabs tabs={TABS} defaultActiveId="missing" aria-label="Property detail" />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wires aria-controls and aria-labelledby between each tab and its panel', () => {
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const tab = screen.getByRole('tab', { name: 'Overview' });
    const panel = screen.getByRole('tabpanel');
    const controls = tab.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(panel).toHaveAttribute('id', controls as string);
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    // the panel is named by its tab
    expect(panel).toHaveAccessibleName('Overview');
  });

  it('switches the panel when another tab is clicked (uncontrolled)', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    await user.click(screen.getByRole('tab', { name: 'Floor plan' }));
    expect(screen.getByRole('tab', { name: 'Floor plan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Floor plan detail');
  });

  it('puts only the active tab in the tab order (roving tabindex)', () => {
    render(<Tabs tabs={TABS} defaultActiveId="floorplan" aria-label="Property detail" />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Floor plan' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves selection right with ArrowRight and wraps at the end', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    expect(overview).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Floor plan' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Floor plan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveFocus();

    // wraps from last back to first
    await user.keyboard('{ArrowRight}');
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
  });

  it('moves selection left with ArrowLeft and wraps at the start', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();

    // wraps from first back to last
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Floor plan' })).toHaveFocus();
  });

  it('jumps to the first tab with Home and the last with End', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} defaultActiveId="floorplan" aria-label="Property detail" />);
    const middle = screen.getByRole('tab', { name: 'Floor plan' });
    middle.focus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores unrelated keys', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    await user.keyboard('{ArrowDown}');
    // selection unchanged, focus unchanged
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
  });

  it('is controlled when activeId is provided — onChange fires, parent owns state', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs tabs={TABS} activeId="overview" onChange={onChange} aria-label="Property detail" />,
    );
    // controlled: clicking does not move selection on its own
    await user.click(screen.getByRole('tab', { name: 'Location' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('location');
    // still showing the parent-controlled active tab
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Property overview');
  });

  it('reflects a controlled activeId change from the parent', async () => {
    const user = userEvent.setup();

    function Harness(): ReactElement {
      const [active, setActive] = useState('overview');
      return <Tabs tabs={TABS} activeId={active} onChange={setActive} aria-label="Detail" />;
    }

    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Floor plan' }));
    expect(screen.getByRole('tab', { name: 'Floor plan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Floor plan detail');
  });

  it('calls onChange in uncontrolled mode as well', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} onChange={onChange} aria-label="Property detail" />);
    await user.click(screen.getByRole('tab', { name: 'Location' }));
    expect(onChange).toHaveBeenCalledWith('location');
    // uncontrolled: selection still moves
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveAttribute('aria-selected', 'true');
  });

  it('supports aria-labelledby on the tablist instead of aria-label', () => {
    render(
      <div>
        <h2 id="detail-heading">Property detail</h2>
        <Tabs tabs={TABS} aria-labelledby="detail-heading" />
      </div>,
    );
    expect(screen.getByRole('tablist')).toHaveAccessibleName('Property detail');
  });

  it('merges a custom className onto the root', () => {
    const { container } = render(
      <Tabs tabs={TABS} className="detail-tabs" aria-label="Property detail" />,
    );
    expect(container.firstChild).toHaveClass('tabs', 'detail-tabs');
  });

  it('renders nothing meaningful when given no tabs', () => {
    render(<Tabs tabs={[]} aria-label="Empty" />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Tabs tabs={TABS} aria-label="Property detail" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
