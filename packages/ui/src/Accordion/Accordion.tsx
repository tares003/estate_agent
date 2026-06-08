// responsive-coverage: opt-out all — the Accordion is fluid (single column,
// full width of its container at every breakpoint); there is no breakpoint-
// specific layout to screenshot. Disclosure behaviour, aria wiring and keyboard
// handling are covered by the RTL + axe suite.
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Accordion.css';

/** A single disclosure row: a header button and the region it controls. */
export interface AccordionItem {
  /** Stable identifier — used as the open-set key and to wire aria-controls. */
  id: string;
  /** The header label. Becomes the disclosure button's accessible name. */
  title: ReactNode;
  /** The panel body, revealed when the item is expanded. */
  content: ReactNode;
}

export interface AccordionProps {
  /** The disclosure rows, rendered top to bottom in array order. */
  items: AccordionItem[];
  /**
   * When `true`, any number of panels may be open at once. When omitted/false
   * (the default), opening one panel collapses the others (single-open).
   */
  allowMultiple?: boolean;
  /**
   * The ids open on first render. In single-open mode only the first id is
   * honoured, preserving the single-open invariant.
   */
  defaultOpenIds?: string[];
  /** Optional class appended to the root, for layout/spacing in the consumer. */
  className?: string;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Derive the initial open set from the props, respecting the single-open rule. */
function initialOpenIds(
  items: AccordionItem[],
  allowMultiple: boolean,
  defaultOpenIds: string[],
): Set<string> {
  const known = new Set(items.map((item) => item.id));
  const valid = defaultOpenIds.filter((id) => known.has(id));
  // single-open: keep at most the first valid default so state never opens two.
  return new Set(allowMultiple ? valid : valid.slice(0, 1));
}

/**
 * Accordion — the first-party EPIC-L disclosure list. Each item renders a real
 * `<button aria-expanded aria-controls>` that toggles a `role="region"` panel
 * labelled by its header via `aria-labelledby` (G9). Collapsed panels are
 * removed from the DOM (and the a11y tree). Supports single-open (default) and
 * multi-open (`allowMultiple`) modes.
 *
 * Keyboard (G9): the native button gives Enter / Space toggling for free; the
 * header group additionally supports Up/Down (with wrap) and Home/End roving
 * between headers. Fully token-driven via `Accordion.css` (G7); the open/close
 * height transition is disabled under `prefers-reduced-motion`.
 */
export function Accordion({
  items,
  allowMultiple = false,
  defaultOpenIds = [],
  className,
}: AccordionProps): ReactElement {
  const baseId = useId();
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    initialOpenIds(items, allowMultiple, defaultOpenIds),
  );
  // Refs to each header button, in item order, for arrow-key roving focus.
  const headerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const toggle = useCallback(
    (id: string): void => {
      setOpenIds((current) => {
        const next = new Set(allowMultiple ? current : []);
        if (current.has(id)) {
          // closing: in single-open mode `next` is already empty.
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [allowMultiple],
  );

  const onHeaderKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
      const count = items.length;
      let target: number | null = null;

      switch (event.key) {
        case 'ArrowDown':
          target = (index + 1) % count;
          break;
        case 'ArrowUp':
          target = (index - 1 + count) % count;
          break;
        case 'Home':
          target = 0;
          break;
        case 'End':
          target = count - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      headerRefs.current[target]?.focus();
    },
    [items.length],
  );

  return (
    <div className={cx('accordion', className)}>
      {items.map((item, index) => {
        const isOpen = openIds.has(item.id);
        const headerId = `${baseId}-h-${item.id}`;
        const panelId = `${baseId}-p-${item.id}`;

        return (
          <div key={item.id} className={cx('accordion-item', isOpen && 'is-open')}>
            <h3 className="accordion-heading">
              <button
                ref={(node) => {
                  headerRefs.current[index] = node;
                }}
                type="button"
                id={headerId}
                className="accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                onKeyDown={(event) => onHeaderKeyDown(event, index)}
              >
                <span className="accordion-title">{item.title}</span>
                <svg
                  className="accordion-chevron"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </h3>
            {isOpen ? (
              <div
                role="region"
                id={panelId}
                aria-labelledby={headerId}
                className="accordion-panel"
              >
                <div className="accordion-panel-inner">{item.content}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
