# @estate/tokens

Runtime accessor for the design tokens. **One source of truth → two consumers:** CSS custom properties (Next.js global stylesheet + Payload CMS admin theming) and a typed TypeScript export (consumed by `packages/ui` and any app-level code).

## Source

Tokens are authored in `DESIGN.md` and `motion-spec.md` and mirrored verbatim in `design/canvas/tokens.css`. This package **ports those values without inventing any** — no raw value originates here. Adding a token requires a `DESIGN.md` amendment first (enforced socially + by guard G7).

## Public surface

- A typed object tree: `tokens.colour.*`, `tokens.space.*`, `tokens.radius.*`, `tokens.text.*`, `tokens.motion.duration.*`, `tokens.motion.easing.*`, `tokens.breakpoint.*`, etc.
- A generated `tokens.css` (CSS custom properties) imported into the Next.js global stylesheet and applied to the Payload admin via Payload's `admin.css` hook.
- The seven canonical breakpoints (320, 640, 768, 1024, 1280, 1440, 2560) exported for the responsive test harness + guard G11.

## Tailwind

The Tailwind CSS config in `apps/web` consumes the token CSS variables directly — token values are never duplicated into `tailwind.config.ts`. Guard G7 catches any raw hex / px / ms in source files that should reference a token.

## Discipline

Test-first: a generation test asserts the TS export and the CSS output stay in lockstep with `design/canvas/tokens.css` (a drift test fails if the canvas changes without this package regenerating). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B1 (EPIC-M).
