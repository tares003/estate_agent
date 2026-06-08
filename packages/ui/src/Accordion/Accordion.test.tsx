// responsive-coverage: opt-out all — the Accordion is fluid (single column, full
// width of its container at every breakpoint); RTL covers the disclosure
// behaviour, aria wiring, keyboard handling and axe cleanliness here.
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Accordion, type AccordionItem } from './Accordion.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (verified instead in the Playwright + axe visual
// suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

const ITEMS: AccordionItem[] = [
  { id: 'tenure', title: 'Tenure', content: <p>Freehold, sold with vacant possession.</p> },
  { id: 'viewing', title: 'Viewing', content: <p>Book a viewing with the agent.</p> },
  { id: 'epc', title: 'EPC rating', content: <p>Energy performance certificate band C.</p> },
];

/** The fixture titles as plain strings, for typed name-option lookups. */
const TITLES = ['Tenure', 'Viewing', 'EPC rating'] as const;

describe('Accordion', () => {
  it('renders one disclosure button per item, labelled by its title', () => {
    render(<Accordion items={ITEMS} />);
    expect(screen.getByRole('button', { name: 'Tenure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Viewing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EPC rating' })).toBeInTheDocument();
  });

  it('starts with every panel collapsed by default', () => {
    render(<Accordion items={ITEMS} />);
    for (const title of TITLES) {
      expect(screen.getByRole('button', { name: title })).toHaveAttribute('aria-expanded', 'false');
    }
    // collapsed panels are not in the accessible tree
    expect(screen.queryByText('Freehold, sold with vacant possession.')).not.toBeInTheDocument();
  });

  it('wires each header to its region via aria-controls / aria-labelledby', () => {
    render(<Accordion items={[ITEMS[0] as AccordionItem]} defaultOpenIds={['tenure']} />);
    const header = screen.getByRole('button', { name: 'Tenure' });
    const region = screen.getByRole('region', { name: 'Tenure' });

    const controls = header.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(region).toHaveAttribute('id', controls as string);

    const labelledBy = region.getAttribute('aria-labelledby');
    expect(labelledBy).toBe(header.getAttribute('id'));
  });

  it('opens a collapsed panel on click and reflects it in aria-expanded', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} />);
    const header = screen.getByRole('button', { name: 'Tenure' });

    expect(header).toHaveAttribute('aria-expanded', 'false');
    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Freehold, sold with vacant possession.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tenure' })).toBeInTheDocument();
  });

  it('closes an open panel on a second click', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} defaultOpenIds={['tenure']} />);
    const header = screen.getByRole('button', { name: 'Tenure' });

    expect(header).toHaveAttribute('aria-expanded', 'true');
    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Freehold, sold with vacant possession.')).not.toBeInTheDocument();
  });

  it('honours defaultOpenIds for the initial open set', () => {
    render(<Accordion items={ITEMS} allowMultiple defaultOpenIds={['tenure', 'epc']} />);
    expect(screen.getByRole('button', { name: 'Tenure' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'EPC rating' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Viewing' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('single-open mode (default): opening one item closes the previously open item', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} defaultOpenIds={['tenure']} />);

    await user.click(screen.getByRole('button', { name: 'Viewing' }));

    expect(screen.getByRole('button', { name: 'Viewing' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tenure' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('multi-open mode: multiple items can be open at once', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} allowMultiple />);

    await user.click(screen.getByRole('button', { name: 'Tenure' }));
    await user.click(screen.getByRole('button', { name: 'Viewing' }));

    expect(screen.getByRole('button', { name: 'Tenure' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Viewing' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('single-open mode collapses defaultOpenIds down to the first id', () => {
    // defensive: a single-open accordion given two default-open ids keeps only
    // the first, so the rendered state never violates the single-open invariant.
    render(<Accordion items={ITEMS} defaultOpenIds={['tenure', 'epc']} />);
    expect(screen.getByRole('button', { name: 'Tenure' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'EPC rating' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('toggles via the Enter and Space keys', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} />);
    const header = screen.getByRole('button', { name: 'Tenure' });

    header.focus();
    expect(header).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('moves focus between headers with the Down and Up arrow keys (wrapping)', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} />);
    const first = screen.getByRole('button', { name: 'Tenure' });
    const second = screen.getByRole('button', { name: 'Viewing' });
    const last = screen.getByRole('button', { name: 'EPC rating' });

    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(first).toHaveFocus();

    // ArrowUp from the first header wraps to the last
    await user.keyboard('{ArrowUp}');
    expect(last).toHaveFocus();

    // ArrowDown from the last header wraps to the first
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();
  });

  it('Home and End jump to the first and last headers', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} />);
    const first = screen.getByRole('button', { name: 'Tenure' });
    const last = screen.getByRole('button', { name: 'EPC rating' });

    first.focus();
    await user.keyboard('{End}');
    expect(last).toHaveFocus();

    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
  });

  it('ignores unrelated keys without changing focus or state', async () => {
    const user = userEvent.setup();
    render(<Accordion items={ITEMS} />);
    const header = screen.getByRole('button', { name: 'Tenure' });

    header.focus();
    await user.keyboard('{ArrowLeft}');
    expect(header).toHaveFocus();
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders nothing meaningful for an empty item list', () => {
    render(<Accordion items={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('passes through an optional className on the root', () => {
    const { container } = render(<Accordion items={ITEMS} className="property-faqs" />);
    expect(container.firstChild).toHaveClass('accordion', 'property-faqs');
  });

  it('works as a controlled-by-parent disclosure across re-renders', async () => {
    const user = userEvent.setup();

    function Harness(): ReactElement {
      const [count, setCount] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setCount((c) => c + 1)}>
            Bump {count}
          </button>
          <Accordion items={ITEMS} />
        </div>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Tenure' }));
    expect(screen.getByRole('button', { name: 'Tenure' })).toHaveAttribute('aria-expanded', 'true');

    // an unrelated parent re-render must not collapse the open panel
    await user.click(screen.getByRole('button', { name: /bump/i }));
    expect(screen.getByRole('button', { name: 'Tenure' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Accordion items={ITEMS} defaultOpenIds={['tenure']} />);
    const root = within(container).getByRole('button', { name: 'Tenure' })
      .parentElement as HTMLElement;
    const results = await axe.run(root.closest('.accordion') as HTMLElement, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
