import {
  forwardRef,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './FormStatus.css';

/**
 * One reviewed value: the field label, its submitted value, and an optional
 * per-item edit callback. When `onEdit` is present an "Edit <label>" control is
 * rendered alongside the value so the user can jump back to that step.
 */
export interface FormReviewItem {
  /** Field label (the `<dt>` term), e.g. `"Property"`. */
  label: ReactNode;
  /** Submitted value (the `<dd>` detail), e.g. `"Palatine Road, M20"`. */
  value: ReactNode;
  /** Optional callback to edit just this item. Renders a per-item edit control. */
  onEdit?: () => void;
}

export interface FormReviewSummaryProps extends Omit<HTMLAttributes<HTMLDListElement>, 'children'> {
  /**
   * The reviewed values, in display order. When empty the component renders
   * nothing. Each item is a label/value pair, optionally with its own
   * {@link FormReviewItem.onEdit}.
   */
  items: ReadonlyArray<FormReviewItem>;
  /**
   * Optional single "Edit" callback for the whole step. Used only when no item
   * supplies its own `onEdit` — per-item edit always wins so the affordance is
   * unambiguous.
   */
  onEdit?: () => void;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Render the accessible text of a label for an edit-control name. */
function labelText(label: ReactNode): string {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : '';
}

/**
 * FormReviewSummary — a read-only review of submitted values for the final step
 * of a multi-step form. Ported from the receipt pattern in
 * `design/canvas/states/success-state-patterns.html`. Token-driven via
 * `FormStatus.css` (G7) and accessible by construction (G9): values are a real
 * definition list (`dl` / `dt` / `dd`) so the label/value relationship is
 * exposed to assistive technology, and any edit affordance is a real `<button>`
 * named for the field it edits ("Edit Property").
 *
 * Per-item `onEdit` takes precedence over the single overall `onEdit`. When
 * neither is supplied the summary is purely read-only. Renders nothing when
 * `items` is empty.
 */
export const FormReviewSummary = forwardRef(function FormReviewSummary(
  { items, onEdit, className, ...rest }: FormReviewSummaryProps,
  ref: ForwardedRef<HTMLDListElement>,
): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  const hasPerItemEdit = items.some((item) => item.onEdit != null);
  // The overall control only shows when no item owns its own edit affordance.
  const showOverallEdit = onEdit != null && !hasPerItemEdit;

  return (
    <dl ref={ref} className={cx('form-review', className)} {...rest}>
      {items.map((item, index) => (
        <div className="form-review__row" key={`${labelText(item.label)}-${index}`}>
          <dt className="form-review__term">{item.label}</dt>
          <dd className="form-review__detail">
            <span className="form-review__value">{item.value}</span>
            {item.onEdit != null ? (
              <button type="button" className="form-review__edit" onClick={item.onEdit}>
                Edit <span className="form-review__edit-label">{item.label}</span>
              </button>
            ) : null}
          </dd>
        </div>
      ))}

      {showOverallEdit ? (
        <div className="form-review__overall">
          <button type="button" className="form-review__edit" onClick={onEdit}>
            Edit
          </button>
        </div>
      ) : null}
    </dl>
  );
});
