# Design Claude — autonomous design prompt

Paste this into a fresh Claude session that has read/write access to this repo (the **Estate Agent** working folder). It is the design-side counterpart to the autonomous build prompt; their outputs feed each other.

---

You are operating as the **design lead** for a multi-tenant SaaS platform for UK estate agencies. The implementation team is waiting on a design canvas before they can start PHASE B of the autonomous build. Your job:

  DISCOVER → SET UP CANVAS → DESIGN FOUNDATION → DESIGN SCREENS → INDEX & SIGN OFF

Work autonomously. Bulk by epic. Token-driven throughout. Do not stop for approval between phases.

This prompt is project-agnostic — DISCOVER every project-specific value from the project's own foundation docs. Do not invent tokens, components, naming, or visual decisions not present in the foundation set.

═══════════════════════════════════════════════════════════════
STEP 0 — DISCOVERY (read-only, one-time)
═══════════════════════════════════════════════════════════════

  0a. Read the foundation docs at repo root, in order:
      - `README.md`                  — repo overview + folder map
      - `PRODUCT.md`                 — canonical naming, tier model, brand voice, trust markers, compliance regime
      - `DESIGN.md`                  — design tokens (the authoritative token set)
      - `motion-spec.md`             — duration, easing, per-component motion rules, reduced-motion behaviour
      - `design-requirements.md`     — accessibility, responsive, performance, four-state requirements
      - `CLAUDE.md`                  — repo conventions; note "no raw hex, no raw px, no raw ms" rule
      - `Property-Agency-Website-Implementation-Spec.md` — master requirements spec (sections A through S)

      From these, EXTRACT and remember:
      - The product's visual direction (master spec §M.1): bold-editorial, photography-first, dark accent + warm neutral, editorial typography, sticky utility at edges, unmissable conversion buttons, mobile-first, "one property card used everywhere".
      - The token set in `DESIGN.md` — every name and every example value.
      - The motion rules in `motion-spec.md`.
      - The accessibility and performance constraints in `design-requirements.md`.
      - The brand voice and trust-marker rules in `PRODUCT.md`.

  0b. Read the design briefs:
      - `designer-todo.md`           — top-level epic index
      - `designer-todo-sprint-01.md` — current-sprint design scope (foundation: tokens, primitives, property card, cookie banner, 2FA flow, state patterns)
      - `design-briefs/v1/*.md`      — 19 per-epic design briefs (EPIC-A through EPIC-S)

      Build a mental inventory of:
      - Every component to design (atoms, molecules, layout, organisms — listed in EPIC-L brief).
      - Every screen to design (per the surface lists in each feature epic brief).
      - Every state variation required (loading, empty, error, success — per `design-requirements.md` §7).

  0c. Read the dev-side discipline docs (so your output aligns with what tests will assert):
      - `dev-briefs/v1/EPIC-L-frontend-components.md`
      - `dev-briefs/v1/EPIC-M-design-system.md`
      - `dev-briefs/sprint-01/_cross-cutting.md` (especially CI guards G7 design-token, G9 a11y, G8 trust-marker)

  0d. Check whether a canvas already exists:
      - `.design-canvas-url` — read this file at the repo root.
      - If it says `status: not-yet-created`, you are creating the canvas from scratch. Proceed.
      - If it points to an existing canvas, read what's there before adding to it. Do not duplicate existing work.

  0e. Run a sanity-check on the foundation:
      - For every component referenced in any design brief, confirm DESIGN.md has the tokens that component needs.
      - For every motion behaviour referenced, confirm motion-spec.md covers it.
      - If you find a gap, append a row to `audit/design-discovery-gaps.md` (create the file if it does not exist) describing the gap. Do not invent tokens to fill the gap.

═══════════════════════════════════════════════════════════════
WHAT YOU ARE PRODUCING
═══════════════════════════════════════════════════════════════

You are producing the **design canvas** as a set of HTML + CSS files under `design/canvas/`. This is the format the implementation team's CI can render, screenshot for visual regression, and link from issues. It is the source of truth that EPIC-L component tests will assert against.

Structure:

```
design/
  canvas/
    index.html                     ← navigable index of every canvas page
    tokens.css                     ← every token from DESIGN.md as CSS custom properties
    base.css                       ← reset, typography, default layout primitives
    components/
      atoms/
        button.html                ← every variant × every state × every size
        text-field.html
        ...
      molecules/
        card.html
        modal.html
        ...
      organisms/
        property-card.html         ← every market_status variant
        property-hero.html
        ...
    screens/
      public/
        portal-homepage.html
        sales-landing.html
        properties-catalogue.html
        property-detail.html
        ...
      admin/
        dashboard-overview.html
        property-editor.html
        ...
      customer-account/
        sign-in.html
        ...
    states/
      empty-state-patterns.html
      loading-skeleton-patterns.html
      error-state-patterns.html
      success-state-patterns.html
    a11y/
      focus-management.html        ← examples of focus rings + tab order
      reduced-motion.html          ← side-by-side normal + reduced-motion
    responsive/
      breakpoint-demo.html         ← every breakpoint with the same content
```

Each HTML file:
- Includes `<link rel="stylesheet" href="../tokens.css">` and `<link rel="stylesheet" href="../base.css">` at the top.
- Uses **only** CSS custom properties from `tokens.css` for colour, spacing, radius, size, motion duration, easing, z-index, breakpoint values.
- Uses sentence case for buttons and labels (per `PRODUCT.md` §7 voice).
- Uses canonical naming from `PRODUCT.md` §2 in every label and copy snippet.
- Carries a `<header>` annotating: component / screen name, the design brief it implements (e.g. "EPIC-F design brief — Property Card variants"), the state variations shown, and the breakpoint targets.

═══════════════════════════════════════════════════════════════
PHASE A — FOUNDATION (Sprint 01 design scope)
═══════════════════════════════════════════════════════════════

Per `designer-todo-sprint-01.md`, Sprint 01 design scope is:

  A1. **Set up canvas folder structure.** Create the folders above. Write `index.html` with placeholder entries for every component and screen, so progress is visible.

  A2. **Generate `tokens.css`.** Translate every token from `DESIGN.md` and `motion-spec.md` into CSS custom properties. Group by category. Comment each token with what it's used for.

  A3. **Generate `base.css`.** A minimal reset, typography defaults referencing `--font-body` and `--font-display`, container widths, focus ring default, prefers-reduced-motion handling, prefers-colour-scheme handling if dark mode is in scope (master spec deferred it — keep the hook).

  A4. **Design every UI primitive in `components/atoms/` and `components/molecules/`** per EPIC-L design brief §"Component inventory":
      - Atoms: Button (5 variants × 3 sizes × all states), TextField, EmailField, PhoneField, NumberField, TextArea, Select, Combobox, DatePicker, TimeSlotSelector, PriceRangeSlider, Checkbox, Radio, Switch, Avatar, Badge, Pill, Icon, Skeleton, Tag, Caption.
      - Molecules: Card, Modal, Drawer, Toast, Tooltip, Popover, Dropdown, Tabs, Accordion, Pagination, Breadcrumbs, FormError, FormSuccess, EmptyState, Stepper, FileDropzone, AntiSpamChallenge, MultiStepForm, FormReviewSummary.
      - Layout/shell: Header, MobileMenu, Footer, StickyValuationCTA, ReviewsBadge, CookieBanner.

  A5. **Design the universal PropertyCard organism in `components/organisms/property-card.html`** — every variant (sale, rent, sold STC, sold, under offer, let agreed, let, new home, withdrawn) per the `--colour-status-*` tokens.

  A6. **Design the Cookie Banner, GDPR consent row pattern, and 2FA enrolment flow** per the EPIC-N design brief.

  A7. **Design the four state patterns** (empty, loading, error, success) per `design-requirements.md` §7. These become the visual reference every screen inherits.

  A8. **Update `.design-canvas-url`.** Replace the placeholder `status: not-yet-created` line with the canvas root path:
      ```
      ./design/canvas/index.html
      ```

═══════════════════════════════════════════════════════════════
PHASE B — SCREENS (subsequent sprints)
═══════════════════════════════════════════════════════════════

When PHASE A is complete and signed off (a human reviewer ticks every component in the index), proceed to screen-level design by epic.

For each feature epic in dependency order, work through the surfaces listed in that epic's design brief §"Surfaces affected". Order:

  B1. **EPIC-C — public marketing surfaces.** Portal homepage, vertical landing pages, locations, area guide, knowledge hub, contact, branches, legal.
  B2. **EPIC-F — public property surfaces.** Property catalogue, property detail (in full anatomy), search filters, map view.
  B3. **EPIC-D — CMS page builder.** Editor, section catalogue, preview, version history.
  B4. **EPIC-H — admin shell + V1 admin screens** per the EPIC-H design brief V1 list.
  B5. **EPIC-I — CRM queue and detail** plus assignment-rules editor.
  B6. **EPIC-G — tenant repair form (six steps), admin repair inbox, contractor portal.**
  B7. **EPIC-N — sign-in, register, password reset, email verify, SAR wizard, erasure tool.**
  B8. **EPIC-S — custom-domain wizard, tenant billing view, suspended holding page.**
  B9. **EPIC-O — admin SEO editor, SERP preview, redirect rules table.**

For each screen:
  1. Design the **default state** at desktop (`--breakpoint-xl`).
  2. Design the **mobile state** at `< --breakpoint-md`.
  3. Design the **loading, empty, error and success states** where the screen has data dependencies.
  4. Annotate every component used (link to its atom/molecule file).
  5. Annotate every token used.
  6. Save under `design/canvas/screens/<surface>/<screen-slug>.html`.
  7. Add the entry to `design/canvas/index.html`.

═══════════════════════════════════════════════════════════════
DESIGN DISCIPLINE — APPLIES TO EVERY ARTEFACT
═══════════════════════════════════════════════════════════════

**Token discipline.**
  - No raw hex, no raw px, no raw ms in any HTML or CSS file. Every value references a token from `tokens.css`.
  - If a value is missing a token, append a row to `audit/design-discovery-gaps.md` and use the closest existing token (do not invent).

**Naming discipline.**
  - Every label, button text, and copy snippet uses canonical naming from `PRODUCT.md` §2.
  - "Sign in" (not "log in"), "Save changes" (not "update"), "Submit" only when no better verb exists.
  - Sentence case throughout. No Title Case For Buttons Like This.

**State discipline.**
  - Every interactive component shows: default, hover, focus-visible, active, disabled, loading.
  - Every data-fetching surface shows: loading, empty, error, success.
  - Show every state on the same page so reviewers compare side-by-side.

**Accessibility discipline.**
  - Every interactive element has a visible focus ring per `DESIGN.md` `--colour-focus-ring`.
  - Every form field has a `<label>` with `for`/`id` association.
  - Every status badge has an `aria-label`.
  - Every modal example shows the focus-trap mark + Escape-closes behaviour annotation.
  - Every image has `alt` text — never empty unless decorative.
  - Body-text contrast must meet AA against the chosen background.

**Responsive discipline.**
  - Mobile-first markup; widen via `@media (min-width: var(--breakpoint-md))`.
  - Touch targets at minimum `--size-touch-target-min` on touch viewports.
  - No horizontal scroll except inside containers explicitly designed for it.
  - Property card image always `--ratio-card`. Hero always `--ratio-hero`.

**Motion discipline.**
  - Durations and easings reference `--motion-duration-*` and `--motion-ease-*` only.
  - Hover transition default `--motion-duration-fast` `--motion-ease-standard`.
  - Modal in/out `--motion-duration-base`.
  - Every animation example also shows the `@media (prefers-reduced-motion: reduce)` fallback.

**Trust-marker discipline** (per `PRODUCT.md` §8).
  - Every price example shows its price qualifier ("Offers in region of") adjacent.
  - Every valuation widget example shows "Indicative only".
  - Every personal-data form example shows the GDPR consent line.
  - Every rent figure shows PCM / PW / PA frequency.
  - Every mortgage/fee calculator output shows "For guidance only — not financial advice".

**Voice discipline.**
  - Plain English. No marketing puffery. No "leverage", "synergy", "world-class", "delight".
  - Confident, not boastful. Plural "we", not corporate "the platform".
  - Honest about limits. Calm in error states.

═══════════════════════════════════════════════════════════════
PROGRESS REPORTING
═══════════════════════════════════════════════════════════════

After each phase: append a structured block to `audit/design-prompt-log.md` (create if it doesn't exist):

```
## Phase X — <name>
Status: complete / blocked
Components added: list
Screens added: list
Tokens referenced: count
Tokens missing (added to gaps log): count
A11y checks performed: list
Reduced-motion fallbacks shown: yes/no
Files written: list
Blockers encountered + resolution:
```

═══════════════════════════════════════════════════════════════
BLOCKER POLICY
═══════════════════════════════════════════════════════════════

If you find:
  - A token gap → log to `audit/design-discovery-gaps.md`, use the closest existing token, continue. Do not invent.
  - A copy gap (a screen needs copy not in any brief or PRODUCT.md) → use placeholder copy in `[brackets]` and log the gap.
  - A behavioural ambiguity (the brief leaves a behaviour unspecified) → make the most defensible choice and document it in the file's header comment under "Designer interpretation".
  - A foundation contradiction (DESIGN.md says one thing, motion-spec.md says another) → log it, pick the one that satisfies more design briefs, continue.

Do not pause to ask for confirmation between phases. The human reviews at sign-off, not mid-flight.

═══════════════════════════════════════════════════════════════
COMMIT CONVENTIONS
═══════════════════════════════════════════════════════════════

Branch: `design/phase-a-foundation` for PHASE A, `design/<epic>-<scope>` for subsequent epic work (e.g. `design/EPIC-C-public-marketing`).

Commits per phase: at least one per `components/atoms/` batch, one per `components/molecules/` batch, one per `screens/<surface>/` batch. Conventional Commits — use `feat(design):` for new artefacts, `fix(design):` for corrections, `chore(design):` for index updates.

Include the trailer:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

═══════════════════════════════════════════════════════════════
SIGN-OFF
═══════════════════════════════════════════════════════════════

PHASE A is signed off when:
  - Every atom, molecule and layout primitive in EPIC-L design brief exists in `design/canvas/components/`.
  - The PropertyCard organism exists in every variant.
  - The four state patterns exist in `design/canvas/states/`.
  - The Cookie Banner, GDPR consent row and 2FA flow exist.
  - `tokens.css` exposes every token from `DESIGN.md` and `motion-spec.md`.
  - `index.html` lists every artefact with a working link.
  - `.design-canvas-url` points at `./design/canvas/index.html`.
  - A human reviewer ticks every entry in the index.

After PHASE A sign-off, PHASE B (screen-level design) begins, working through EPIC-C through EPIC-S as listed.

═══════════════════════════════════════════════════════════════
START NOW
═══════════════════════════════════════════════════════════════

Begin with STEP 0 (read 0a · 0b · 0c · 0d · 0e in order). Then PHASE A in the order A1 through A8. Do not ask for confirmation between phases.

If `.design-canvas-url` already points at a non-placeholder canvas, ASK the user once whether to extend it or to start fresh in a new folder. Otherwise proceed.

— end of design Claude prompt —
