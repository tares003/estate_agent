# G7 — Design-token literal (no raw hex / px / ms / easing)

**Catches:** a raw visual value hardcoded where a design token must be used (`DESIGN.md` §11 / `motion-spec.md` / DoD item 9).

**Enforced by:** the ESLint rule `estate/design-token` (`packages/config/plugin/rules/g07-design-token.js`, messageIds `rawColor`, `rawPx`, `rawMs`, `rawEasing`).

**Trigger (scoped to styling contexts to avoid false positives):**

- string values inside a JSX `style={{ ... }}` object, and
- Tailwind arbitrary values in a `className` / `class` string — `bg-[#1F2937]`, `p-[16px]`.

Patterns flagged: hex colour `#RGB`/`#RRGGBB`/`#RRGGBBAA` → `rawColor`; `…px` → `rawPx`; `…ms` → `rawMs`; `cubic-bezier(…)` or a named easing (`ease-in-out`, `linear`, …) → `rawEasing`.

**Exemption:** `packages/tokens/**` is the single source where the raw values legitimately live (ported from `design/canvas/tokens.css`); the rule is turned off there in `eslint/base.js`.

**How to satisfy:** reference the token CSS variables (`var(--colour-brand-primary)`, `var(--space-4)`, `var(--motion-duration-fast)`) or the Tailwind token utilities (`bg-brand`, `p-4`). A genuinely new value requires a documented `DESIGN.md` amendment.

**Canonical violation → fix:** `style={{ color:'#1F2937', padding:'16px', transition:'all 150ms ease-in-out' }}` raises four errors; the token-driven equivalent passes.
