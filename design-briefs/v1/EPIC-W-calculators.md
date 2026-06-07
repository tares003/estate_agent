# EPIC-W — Stamp Duty and Mortgage calculators (design)

**Dev brief:** [dev-briefs/v1/EPIC-W-calculators.md](../../dev-briefs/v1/EPIC-W-calculators.md).
**Master spec reference:** Sections B.58, B.59.
**Pack:** `calculators` (add-on; included with all tiers per PRODUCT.md §5c).
**Status:** NOT_STARTED.

## Surfaces affected

- Standalone calculator pages (linked from Buyers landing).
- Embeddable calculator section type within page-builder.
- Property detail page → indicative Mortgage figure as a small embedded variant.
- Admin → Settings → Calculator configuration screen.

## Layout patterns

### Standalone Stamp Duty calculator

- Hero with title and one-sentence explanation ("How much SDLT will I pay?").
- Input form: purchase price (currency input with thousand separators), buyer category radio (First-time buyer / Home mover / Additional property), region select (England & NI / Wales / Scotland).
- Result panel below the inputs, updating in real-time:
  - Headline: total tax due, prominent.
  - Effective rate as percentage of purchase price.
  - Per-band breakdown as a small horizontal stacked bar with hover tooltips.
  - "For guidance only — not financial advice" disclosure adjacent.
  - "Last updated: [date]" caption below the result.
  - "Print / export" action.

### Standalone Mortgage calculator

- Same hero pattern, title "How much will my mortgage cost?".
- Input form: purchase price, deposit (currency or %), mortgage rate (% with stepper), term (years), preset dropdown.
- Result panel:
  - Headline: monthly repayment.
  - Secondary: total interest, total payable, LTV ratio.
  - Small amortisation chart (toggle: by year).
  - Disclosure adjacent.

### Embedded variant on property detail

- Compact card showing: indicative monthly repayment for the property's price at the configured default rate and term.
- "See full calculation" link expands the full calculator inline or opens it in a modal.

### Admin settings → Calculator configuration

- Tabs: SDLT / Mortgage.
- SDLT tab: per-region band tables editable inline, with "Last updated" timestamp and a save button.
- Mortgage tab: default rate, default term, preset list editor.

## Component inventory

`StampDutyCalculator`, `MortgageCalculator`, `CalculatorResultPanel`, `BandBreakdownBar`, `AmortisationChart`, `CalculatorDisclosure`, `MortgageEmbeddedSummary`, `CalculatorConfigScreen`.

## State variations

- **No inputs yet:** placeholder result panel ("Enter a purchase price to see your indicative tax").
- **Inputs at zero or invalid:** inline validation ("Purchase price must be greater than zero").
- **Result very low:** prominent "No SDLT due at this price under your category" message.
- **Print / export in progress:** subtle "Preparing PDF…" indicator.

## Accessibility specifics

- Currency input has `inputmode="numeric"` and accepts numbers without separators.
- Result panel updates announced via `aria-live="polite"` only on significant changes (not on every keystroke).
- Disclosure text is body-size, not caption-size, so it cannot be missed.
- Stepper buttons on mortgage rate are keyboard-operable with arrow keys.

## Responsive

- Standalone calculators: input form stacks above result panel on mobile.
- Embedded variant on property detail: fits in the right rail on desktop, becomes a full-width card below the price block on mobile.

## Motion

- Result panel transitions: result figure cross-fades on change over `--motion-duration-fast`.
- Band-breakdown bar segments animate width on load over `--motion-duration-slow`; subsequent updates are immediate.
- Reduced-motion: replace all transitions with instant state change.

## Token references

- Headline result figure: `--text-display-md` weight semibold.
- Disclosure: `--text-body-sm` `--colour-text-muted`.
- Band-breakdown bar segments: cycled status tokens for visual differentiation.

## Open design questions

1. Confirm the visual treatment of the disclosure — inline italic, badge pill, or boxed callout (recommended: boxed callout for emphasis).
2. Confirm whether the embedded mortgage summary on property detail uses the property's price or a user-overridable price (recommended: property's price with an "Adjust" affordance).
3. Confirm whether the band-breakdown bar shows percentage labels or absolute amounts (recommended: amounts on hover, percentages always visible).
4. Confirm the colour treatment of the bands (alternating shades vs status tokens — recommended: alternating shades of `--colour-brand-primary` for visual coherence).
