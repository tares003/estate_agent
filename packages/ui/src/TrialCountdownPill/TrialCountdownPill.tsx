import { forwardRef, type ForwardedRef, type HTMLAttributes, type ReactElement } from 'react';
import './TrialCountdownPill.css';

/**
 * Visual treatment for the pill. `calm` is the default for a trial with plenty
 * of runway; `urgent` is the warning/danger treatment used as the trial nears
 * its end; `ended` is the spent-trial state.
 *
 * The tone is normally *derived* from `daysRemaining`, but a caller may pass an
 * explicit `tone` to force the treatment (e.g. an operator screen that wants to
 * highlight a trial regardless of how many days are left). The override never
 * changes the textual meaning — the label always follows `daysRemaining`.
 */
export type TrialCountdownPillTone = 'calm' | 'urgent' | 'ended';

/** Days at or below which the trial is treated as urgent. */
const URGENT_THRESHOLD_DAYS = 3;

export interface TrialCountdownPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Whole days left in the trial. A fractional value is floored. `0` or any
   * negative value renders the ended state.
   */
  daysRemaining: number;
  /**
   * Force a visual treatment instead of deriving it from `daysRemaining`. The
   * label is unaffected — it always reflects the real day count.
   */
  tone?: TrialCountdownPillTone;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Derive the default tone from the floored day count. */
function deriveTone(days: number): TrialCountdownPillTone {
  if (days <= 0) return 'ended';
  if (days <= URGENT_THRESHOLD_DAYS) return 'urgent';
  return 'calm';
}

/** Visible (and default accessible) label for a floored day count. */
function labelFor(days: number): string {
  if (days <= 0) return 'Trial ended';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

/**
 * TrialCountdownPill — a status atom showing the time left in a pack trial
 * (EPIC-AD). A non-interactive `<span>` shaped with `--radius-pill`, fully
 * token-driven via `TrialCountdownPill.css` (G7).
 *
 * - Pluralises correctly: "1 day left" vs "N days left".
 * - At or below {@link URGENT_THRESHOLD_DAYS} days it switches to the urgent
 *   warning/danger treatment; at zero or fewer it renders "Trial ended".
 * - Status is conveyed by the visible text plus an explicit `aria-label`, never
 *   by colour alone (G9).
 */
export const TrialCountdownPill = forwardRef(function TrialCountdownPill(
  { daysRemaining, tone, className, 'aria-label': ariaLabel, ...rest }: TrialCountdownPillProps,
  ref: ForwardedRef<HTMLSpanElement>,
): ReactElement {
  const days = Math.floor(daysRemaining);
  const resolvedTone = tone ?? deriveTone(days);
  const label = labelFor(days);
  // The ended label already reads as a full status; the countdown labels get a
  // "Trial:" prefix so the accessible name is self-describing out of context.
  const accessibleName = ariaLabel ?? (days <= 0 ? label : `Trial: ${label}`);

  return (
    <span
      ref={ref}
      className={cx('trial-countdown-pill', resolvedTone, className)}
      aria-label={accessibleName}
      {...rest}
    >
      {label}
    </span>
  );
});
