import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Tabs.css';

/** One tab and its associated panel content. */
export interface TabItem {
  /** Stable identifier used for selection and aria wiring; unique within the set. */
  id: string;
  /** The tab's visible label (also its accessible name). */
  label: ReactNode;
  /** The panel content shown while this tab is active. */
  content: ReactNode;
}

export interface TabsProps {
  /** The tabs to render, in order. The first is selected by default. */
  tabs: TabItem[];
  /**
   * Controlled selection: the id of the active tab. When provided, the parent
   * owns the state and must update it in `onChange`; the component will not
   * change selection on its own.
   */
  activeId?: string;
  /**
   * Uncontrolled initial selection: the id of the tab active on first render.
   * Ignored when `activeId` is provided. Falls back to the first tab when it
   * does not match any tab.
   */
  defaultActiveId?: string;
  /** Called with the newly-requested tab id whenever the user selects a tab. */
  onChange?: (id: string) => void;
  /** Accessible name for the tablist (use this OR `aria-labelledby`). */
  'aria-label'?: string;
  /** Id of an element that names the tablist (use this OR `aria-label`). */
  'aria-labelledby'?: string;
  /** Extra class names merged onto the root element. */
  className?: string;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Tabs — the first-party EPIC-L tabs composite. Renders a `role="tablist"` of
 * real `<button role="tab">` controls and a single `role="tabpanel"` for the
 * active tab.
 *
 * API: array-driven (`tabs={[{ id, label, content }]}`). Works controlled
 * (`activeId` + `onChange`, parent owns state) or uncontrolled
 * (`defaultActiveId`, optional `onChange`).
 *
 * Accessible by construction (G9): the WAI-ARIA tabs pattern — each tab carries
 * `aria-selected` and `aria-controls`; the panel carries `aria-labelledby`
 * pointing back at its tab; a roving tabindex keeps exactly one tab in the Tab
 * order; ArrowLeft/ArrowRight move (and wrap) between tabs, Home/End jump to the
 * first/last. Token-driven via `Tabs.css` (G7); the tab controls meet the 44px
 * touch-target minimum.
 */
export function Tabs({
  tabs,
  activeId,
  defaultActiveId,
  onChange,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: TabsProps): ReactElement {
  const baseId = useId();
  /** Refs to each tab button, keyed by tab id, for moving DOM focus. */
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  // The first tab is the default selection; an explicit defaultActiveId wins
  // only when it actually matches a tab.
  const fallbackId = tabs[0]?.id;
  const resolvedDefault =
    defaultActiveId !== undefined && tabs.some((tab) => tab.id === defaultActiveId)
      ? defaultActiveId
      : fallbackId;

  const [internalActiveId, setInternalActiveId] = useState<string | undefined>(resolvedDefault);

  const isControlled = activeId !== undefined;
  const selectedId = isControlled ? activeId : internalActiveId;

  /** Request a selection: notify the parent, and move state ourselves when uncontrolled. */
  const select = useCallback(
    (id: string): void => {
      if (!isControlled) setInternalActiveId(id);
      onChange?.(id);
    },
    [isControlled, onChange],
  );

  /** Move DOM focus to a tab and select it (arrow/Home/End navigation). */
  const focusAndSelect = useCallback(
    (id: string): void => {
      tabRefs.current.get(id)?.focus();
      select(id);
    },
    [select],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
      const count = tabs.length;
      if (count === 0) return;

      let nextIndex: number | null = null;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (index + 1) % count;
          break;
        case 'ArrowLeft':
          nextIndex = (index - 1 + count) % count;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = count - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const next = tabs[nextIndex];
      if (next) focusAndSelect(next.id);
    },
    [tabs, focusAndSelect],
  );

  const activeTab = tabs.find((tab) => tab.id === selectedId);

  return (
    <div className={cx('tabs', className)}>
      <div
        role="tablist"
        className="tabs-list"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
      >
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selectedId;
          const tabId = `${baseId}-tab-${tab.id}`;
          const panelId = `${baseId}-panel-${tab.id}`;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={tabId}
              className={cx('tabs-tab', isSelected && 'is-selected')}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab ? (
        <div
          role="tabpanel"
          className="tabs-panel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          tabIndex={0}
        >
          {activeTab.content}
        </div>
      ) : null}
    </div>
  );
}
