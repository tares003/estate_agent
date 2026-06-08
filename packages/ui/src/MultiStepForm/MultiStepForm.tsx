import { useCallback, useId, useState, type ReactElement, type ReactNode } from 'react';
import { Button } from '../Button/Button.js';
import './MultiStepForm.css';

/** One step in the flow: a stable id, a visible title, and the panel content. */
export interface MultiStepFormStep {
  /** Stable identifier used for selection and aria wiring; unique within the set. */
  id: string;
  /** The step's visible title, shown in the indicator and as the panel's name. */
  title: string;
  /** The content shown while this step is active. */
  content: ReactNode;
}

export interface MultiStepFormProps {
  /** The steps to render, in order. The first is active by default. */
  steps: MultiStepFormStep[];
  /**
   * Uncontrolled initial step: the id of the step active on first render.
   * Ignored when `currentStepId` is provided. Falls back to the first step
   * when it does not match any step.
   */
  defaultStepId?: string;
  /**
   * Controlled active step: the id of the active step. When provided, the
   * parent owns the state and must update it in `onStepChange`; the component
   * will not change steps on its own.
   */
  currentStepId?: string;
  /** Called with the newly-requested step id whenever the user navigates. */
  onStepChange?: (id: string) => void;
  /** Called when the user presses Next/Finish on the final step. */
  onComplete?: () => void;
  /** Extra class names merged onto the root element. */
  className?: string;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Screen-reader status word for a step relative to the active index. */
function statusLabel(stepIndex: number, activeIndex: number): string {
  if (stepIndex < activeIndex) return 'Completed';
  if (stepIndex === activeIndex) return 'Current step';
  return 'Not completed';
}

/**
 * MultiStepForm — the first-party EPIC-L stepper composite. Renders an
 * accessible step indicator (an `<ol>` whose active `<li>` carries
 * `aria-current="step"`, with completed / current / upcoming state spelled out
 * in visually-hidden text so it is never conveyed by colour alone — G9), the
 * active step's content in a named `role="group"` region, and Back / Next
 * navigation built from the `Button` atom.
 *
 * API: array-driven (`steps={[{ id, title, content }]}`). Works controlled
 * (`currentStepId` + `onStepChange`, parent owns state) or uncontrolled
 * (`defaultStepId`, optional `onStepChange`). Pressing Next on the final step
 * calls `onComplete`. Back is disabled on the first step. Token-driven via
 * `MultiStepForm.css` (G7); the navigation controls meet the 44px touch-target
 * minimum via the `Button` atom.
 */
export function MultiStepForm({
  steps,
  defaultStepId,
  currentStepId,
  onStepChange,
  onComplete,
  className,
}: MultiStepFormProps): ReactElement {
  const baseId = useId();

  // The first step is the default; an explicit defaultStepId wins only when it
  // actually matches a step.
  const fallbackId = steps[0]?.id;
  const resolvedDefault =
    defaultStepId !== undefined && steps.some((step) => step.id === defaultStepId)
      ? defaultStepId
      : fallbackId;

  const [internalStepId, setInternalStepId] = useState<string | undefined>(resolvedDefault);

  const isControlled = currentStepId !== undefined;
  const activeId = isControlled ? currentStepId : internalStepId;

  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeId),
  );
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === steps.length - 1;

  /** Request a step: notify the parent, and move state ourselves when uncontrolled. */
  const goTo = useCallback(
    (index: number): void => {
      const step = steps[index];
      if (!step) return;
      if (!isControlled) setInternalStepId(step.id);
      onStepChange?.(step.id);
    },
    [steps, isControlled, onStepChange],
  );

  const handleBack = useCallback((): void => {
    if (!isFirst) goTo(activeIndex - 1);
  }, [isFirst, goTo, activeIndex]);

  const handleNext = useCallback((): void => {
    if (isLast) {
      onComplete?.();
      return;
    }
    goTo(activeIndex + 1);
  }, [isLast, onComplete, goTo, activeIndex]);

  const activeStep = steps[activeIndex];
  const panelId = `${baseId}-panel`;

  return (
    <div className={cx('multi-step-form', className)}>
      <ol className="multi-step-form-steps">
        {steps.map((step, index) => {
          const status = statusLabel(index, activeIndex);
          const isActive = index === activeIndex;
          return (
            <li
              key={step.id}
              className={cx(
                'multi-step-form-step',
                index < activeIndex && 'is-complete',
                isActive && 'is-current',
              )}
              {...(isActive ? { 'aria-current': 'step' as const } : {})}
            >
              <span className="multi-step-form-marker" aria-hidden="true">
                {index + 1}
              </span>
              <span className="multi-step-form-step-title">{step.title}</span>
              <span className="multi-step-form-step-status">{status}</span>
            </li>
          );
        })}
      </ol>

      {activeStep ? (
        <div
          role="group"
          className="multi-step-form-panel"
          id={panelId}
          aria-label={activeStep.title}
        >
          {activeStep.content}
        </div>
      ) : null}

      <div className="multi-step-form-nav">
        <Button
          type="button"
          variant="secondary"
          onClick={handleBack}
          disabled={isFirst}
          aria-controls={panelId}
        >
          Back
        </Button>
        <Button type="button" variant="primary" onClick={handleNext} aria-controls={panelId}>
          {isLast ? 'Finish' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
