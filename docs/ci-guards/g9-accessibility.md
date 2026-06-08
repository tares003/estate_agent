# G9 — Accessibility smoke (WCAG 2.2 AA)

**Catches:** any WCAG 2.2 AA accessibility violation on a new public route (`design-requirements.md` §1 / DoD item 7).

**Enforced by:** the evaluation core in `packages/config/guards/g09-accessibility.ts` (`evaluateAxe` — fails on **any** returned violation, since the axe run is configured for AA). The full `@axe-core/playwright` runtime scan, run at the seven breakpoints against the production build, is a CI job that **activates when `apps/web` ships** (the `runtime-gates` job in `.github/workflows/ci.yml`).

**Covers (per §1):** keyboard reachability, visible focus ring, logical tab order, skip-to-content, meaningful/empty alt text, `<label>` association (no placeholder-only labels), `aria-describedby` + polite live region on form errors, focus-trapped/Escape-dismissible modals, correct ARIA roles/state, `aria-label` on status badges (colour is not the only signal), keyboard equivalents for drag-and-drop, captions, and a textual map fallback. Contrast: body ≥ 4.5:1, large text ≥ 3:1, UI/graphics ≥ 3:1 — at every breakpoint.

**How to satisfy:** associate every input with a `<label>`, meet contrast with token colours, ensure keyboard operability and visible focus, and run the route through axe locally before pushing.

**Canonical violation → fix:** a contact form with a placeholder-only email input and sub-4.5:1 button text fails axe; a real `<label for>` + token AA colours passes with zero violations.
