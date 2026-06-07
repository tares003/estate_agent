# EPIC-W — Stamp Duty and Mortgage calculators

**Master spec reference:** Section B.58 (Stamp Duty), Section B.59 (Mortgage), Section P.2 (build).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-W-calculators.md](../../design-briefs/v1/EPIC-W-calculators.md).

## Purpose

Implement two indicative calculators that appear on public surfaces (Buyers / Sellers / Property detail pages) and inside the customer account where appropriate. Both are **indicative only** — the platform does not provide financial advice (per `PRODUCT.md` §9). The trust-marker rule from `PRODUCT.md` §8 applies: every calculator output must declare *"For guidance only — not financial advice"* adjacent to its result.

## Functional requirements

### Stamp Duty calculator

- **FR-W-1.** A visitor shall be able to compute indicative Stamp Duty Land Tax for a residential purchase by entering the purchase price and selecting their buyer category (first-time buyer, home mover, additional property).
- **FR-W-2.** The calculator shall apply the configured SDLT bands (England + Northern Ireland default). Per-region overrides (Wales LTT, Scotland LBTT) shall be supported via configuration.
- **FR-W-3.** The configured bands shall be admin-editable (master spec Section B.58) so that thresholds can be updated when HMRC announces a change without redeploy.
- **FR-W-4.** The result shall display: total tax due, the per-band breakdown, the effective rate as a percentage of the purchase price, and the date the configured bands were last updated.

### Mortgage calculator

- **FR-W-5.** A visitor shall be able to compute an indicative monthly repayment by entering purchase price, deposit amount, mortgage rate (annual), and term (years).
- **FR-W-6.** The calculator shall produce: monthly repayment, total interest over term, total amount payable, loan-to-value ratio.
- **FR-W-7.** Configured defaults (default rate, default term, default deposit percentage) shall be admin-editable.
- **FR-W-8.** The calculator shall include a presets dropdown (e.g. 2-year fixed, 5-year fixed) backed by admin-managed rate snapshots.

### Cross-cutting

- **FR-W-9.** Both calculators shall be embeddable as components on any CMS-managed page via the page-builder.
- **FR-W-10.** Both calculators shall present results with the "For guidance only — not financial advice" disclosure adjacent to the result.
- **FR-W-11.** Calculator usage shall be anonymously analytics-tracked (number of computations, average inputs) to inform editorial direction. No personal data is captured.
- **FR-W-12.** A visitor shall be able to print or export the result as a PDF for sharing.

## User stories

- As a first-time buyer, I want to know roughly how much Stamp Duty I would owe on a property I'm interested in before I make an offer.
- As a buyer comparing properties, I want a rough monthly mortgage cost so I can sense-check affordability.
- As an admin, I want to update the SDLT bands the day after a Budget announcement without engineering.
- As a marketing manager, I want to embed the Stamp Duty calculator on a campaign landing page for Stamp Duty Holiday content.

## Acceptance criteria

- A change to SDLT bands in the admin takes effect on the next page load.
- The Mortgage calculator's amortisation matches a known-good reference calculator within £1 over a 25-year term.
- The "For guidance only" disclosure is present and contrast-compliant.
- The calculator works correctly on a mobile viewport with a numeric keyboard.
- Anonymous usage analytics flows through to the configured analytics destination.

## Test mapping

```
FR-W-1  → tests/component/stamp-duty-calculator.test.*, tests/unit/sdlt-formula.test.*
FR-W-2  → tests/unit/sdlt-regional-overrides.test.* (England/Wales/Scotland)
FR-W-3  → tests/integration/sdlt-bands-admin.test.*
FR-W-4  → tests/component/sdlt-result-display.test.*
FR-W-5  → tests/component/mortgage-calculator.test.*, tests/unit/mortgage-formula.test.* (property-based)
FR-W-6  → tests/component/mortgage-result-display.test.*
FR-W-7  → tests/integration/mortgage-defaults-admin.test.*
FR-W-8  → tests/integration/mortgage-presets.test.*
FR-W-9  → tests/integration/calculator-page-embed.test.*
FR-W-10 → tests/component/calculator-disclosure.test.* (the trust-marker CI guard will assert presence)
FR-W-11 → tests/integration/calculator-analytics.test.*
FR-W-12 → tests/integration/calculator-pdf-export.test.*
A11y    → tests/a11y/calculators.spec.*
Visual  → tests/visual/calculators.spec.*
```

## Dependencies

- EPIC-J — `settings` table holds SDLT bands, mortgage defaults, and rate snapshots.
- EPIC-D — page-builder embed of either calculator as a section type.
- EPIC-N — anti-spam not applicable (no submission), but trust-marker enforcement applies.
- EPIC-K — capability for retrieving the public configured bands at runtime.

## Open questions

1. Confirm the V1 regional coverage (recommended: England + Wales + Scotland; Northern Ireland follows England).
2. Confirm whether the Mortgage calculator surfaces affordability checks against income (recommended: no — straying into regulated advice territory).
3. Confirm whether the PDF export is in V1 (recommended: yes for Stamp Duty, optional for Mortgage).
4. Confirm whether the Stamp Duty calculator handles non-residential purchases (recommended: no in V1).
