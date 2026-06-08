import { describe, it, expect } from 'vitest';
import { evaluateAxe } from './g09-accessibility.js';

// G9 — Accessibility-smoke guard. The pure evaluation core of the axe-core gate:
// fail on ANY violation, because the runtime scan is configured for WCAG 2.2 AA
// and every returned violation is therefore an AA failure. Deterministic inline
// fixtures only — no Playwright, no DOM, no network, no filesystem.
describe('G9 accessibility: evaluateAxe fails on any WCAG 2.2 AA violation', () => {
  // DELIBERATE-VIOLATION case (fail-closed proof): a page with axe violations
  // must be REJECTED, and every violation id must be surfaced for the report.
  it('rejects a result with violations and lists their ids in order', () => {
    const verdict = evaluateAxe({
      violations: [
        { id: 'label', impact: 'critical' },
        { id: 'color-contrast', impact: 'serious' },
      ],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.violationIds).toEqual(['label', 'color-contrast']);
  });

  // A single violation is still a hard failure — there is no advisory bucket
  // to tolerate under an AA-configured run.
  it('rejects a result with a single violation', () => {
    const verdict = evaluateAxe({
      violations: [{ id: 'aria-required-attr', impact: 'serious' }],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.violationIds).toEqual(['aria-required-attr']);
  });

  // CLEAN case: a page with zero violations must PASS with an empty id list.
  it('passes a clean result with no violations', () => {
    const verdict = evaluateAxe({ violations: [] });

    expect(verdict.ok).toBe(true);
    expect(verdict.violationIds).toEqual([]);
  });

  // The `impact` field is informational only — its presence or absence never
  // changes the verdict; the violation's existence is what fails the gate.
  it('fails regardless of whether impact is present', () => {
    const verdict = evaluateAxe({ violations: [{ id: 'image-alt' }] });

    expect(verdict.ok).toBe(false);
    expect(verdict.violationIds).toEqual(['image-alt']);
  });
});
