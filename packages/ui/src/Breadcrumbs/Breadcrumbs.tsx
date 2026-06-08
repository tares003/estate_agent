// responsive-coverage: opt-out all — Breadcrumbs is a fluid inline trail; responsive layout is verified where it composes into page/organism tests
import { Fragment, type HTMLAttributes, type ReactElement } from 'react';
import './Breadcrumbs.css';

/**
 * One crumb in the trail. A crumb with an `href` renders as a link; a crumb
 * without one renders as plain text marked as the current page.
 */
export interface BreadcrumbItem {
  /** Visible label for the crumb. */
  label: string;
  /** Destination. Omit for the current/last crumb, which renders as plain text. */
  href?: string;
}

export interface BreadcrumbsProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The trail, root first. The last crumb — and any crumb without an `href` —
   * renders as plain text with `aria-current="page"` rather than a link.
   */
  items: BreadcrumbItem[];
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Breadcrumbs — the first-party EPIC-L navigation trail. Renders a
 * `<nav aria-label="Breadcrumb">` wrapping an ordered list (G9): each crumb with
 * an `href` is a real `<a>`; the last crumb (and any crumb lacking an `href`) is
 * plain text marked `aria-current="page"`. The chevron separators are decorative
 * and hidden from assistive tech (`aria-hidden`). Token-driven via
 * `Breadcrumbs.css` (G7).
 */
export function Breadcrumbs({ items, className, ...rest }: BreadcrumbsProps): ReactElement | null {
  if (items.length === 0) return null;

  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={cx('breadcrumbs', className)} {...rest}>
      <ol className="breadcrumbs-list">
        {items.map((item, index) => {
          // The trailing crumb is always current; an interior crumb without an
          // href is treated as current/plain too.
          const isCurrent = index === lastIndex || item.href === undefined;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li className="breadcrumbs-item">
                {isCurrent ? (
                  <span className="breadcrumbs-current" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <a className="breadcrumbs-link" href={item.href}>
                    {item.label}
                  </a>
                )}
              </li>
              {index < lastIndex ? (
                <li className="breadcrumbs-separator" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
