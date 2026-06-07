# Design Claude — autonomous design prompt

Paste this into a fresh Claude session that has read/write access to this repo (the **Estate Agent** working folder). It is the design-side counterpart to the autonomous build prompt; their outputs feed each other.

═══════════════════════════════════════════════════════════════
RULE ZERO — RESPONSIVE DESIGN IS NOT OPTIONAL
═══════════════════════════════════════════════════════════════

Before you read anything else in this prompt, internalise this:

**EVERY artefact you produce must be fully responsive across the entire site at every breakpoint defined in `DESIGN.md` §10 — 320 px, 640 px, 768 px, 1024 px, 1280 px, 1440 px and 2,560 px.**

This applies to:
- Every public page (portal homepage, every vertical landing, property catalogue, property detail, area guides, knowledge hub, contact, branches, legal pages).
- Every customer-account screen.
- Every admin screen.
- Every operator-tier admin screen.
- Every vendor / landlord / tenant portal screen.
- Every component, atom, molecule, organism in the library.
- Every email template (renders at mobile and desktop client widths).
- Every modal, drawer, popover, tooltip, toast.
- Every state variation (empty, loading, error, success).
- Every form, every wizard, every multi-step flow.

There is no surface in this product that is exempt. There is no "desktop-only" screen. There is no "we'll do mobile later". An artefact that has not been verified at every breakpoint is not signed off and is not merged.

The CI guard G11 in `dev-briefs/sprint-01/_cross-cutting.md` enforces this technically. Your job is to honour it in every file you produce.

Mobile-first markup. Touch + mouse + keyboard at every breakpoint. No hover-only interactions. No horizontal scroll. Touch targets ≥ 44 px on touch viewports regardless of viewport width. No content reflow that disorientates the user between breakpoints.

If you find a surface that honestly cannot work below a given breakpoint (e.g. some destructive operator-admin controls), you must explicitly state that in the file's header and show the graceful-degradation pattern at the smaller viewport — never silently break.

═══════════════════════════════════════════════════════════════

You are operating as the **design lead** for a multi-tenant SaaS platform for UK estate agencies. The implementation team is waiting on a design canvas before they can start PHASE B of the autonomous build. Your job:

  DISCOVER → SET UP CANVAS → DESIGN FOUNDATION → DESIGN SCREENS → INDEX & SIGN OFF

Work autonomously. Bulk by epic. Token-driven throughout. Responsive-first throughout. Do not stop for approval between phases.

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
- **Shows the artefact at every one of the seven breakpoints (320, 640, 768, 1024, 1280, 1440, 2560 px) side-by-side or in stacked `<iframe>`s with explicit width attributes**, so a reviewer can scroll one file and verify the responsive behaviour without resizing their browser. This is non-negotiable per RULE ZERO.

### Responsive verification block — required in every file

Every component file and every screen file MUST include this block at the bottom:

```html
<section class="responsive-verification">
  <h2>Responsive verification — every breakpoint</h2>
  <p>Per RULE ZERO and per <code>design-requirements.md</code> §0.</p>
  <iframe src="?embed&width=320"   width="320"   height="600"  title="320 px (mobile S)"></iframe>
  <iframe src="?embed&width=640"   width="640"   height="800"  title="640 px (mobile L)"></iframe>
  <iframe src="?embed&width=768"   width="768"   height="900"  title="768 px (tablet)"></iframe>
  <iframe src="?embed&width=1024"  width="1024"  height="900"  title="1024 px (small desktop)"></iframe>
  <iframe src="?embed&width=1280"  width="1280"  height="900"  title="1280 px (desktop)"></iframe>
  <iframe src="?embed&width=1440"  width="1440"  height="900"  title="1440 px (wide)"></iframe>
  <iframe src="?embed&width=2560"  width="2560"  height="1200" title="2560 px (ultra-wide)"></iframe>
</section>
```

The `?embed` query param tells `base.css` to hide chrome and render only the artefact at the requested width. A file without this block is considered incomplete and will not be signed off.

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

**Responsive discipline. This is the first rule of the project.**
  - **Every artefact you produce must be fully responsive at every breakpoint defined in `DESIGN.md` §10** — 320, 640, 768, 1024, 1280, 1440 and 2560 px. Mandate is in `design-requirements.md` §0.
  - For each component HTML file, show the component at every breakpoint side-by-side or in stacked iframes so reviewers can scroll a single page and see every viewport.
  - For each screen HTML file, produce the full layout at 320 px (mobile) and at 1280 px (desktop) as the minimum; include 768 px (tablet) for non-trivial screens.
  - Mobile-first markup; widen via `@media (min-width: var(--breakpoint-md))`.
  - Touch targets at minimum `--size-touch-target-min` (44 px) on touch viewports, regardless of breakpoint.
  - No horizontal scroll except inside containers explicitly designed for it.
  - No hover-only interactions — every interaction must work on touch.
  - No content reflow that disorientates the user between breakpoints.
  - Property card image always `--ratio-card`. Hero always `--ratio-hero`.
  - If a surface honestly cannot work below a given breakpoint (e.g. operator admin destructive controls), explicitly state that in the file header and show the graceful-degradation pattern (e.g. "Use a desktop to perform this action") at the smaller viewport.

**Motion discipline.**
  - Durations and easings reference `--motion-duration-*` and `--motion-ease-*` only.
  - Hover transition default `--motion-duration-fast` `--motion-ease-standard`.
  - Modal in/out `--motion-duration-base`.
  - Every animation example also shows the `@media (prefers-reduced-motion: reduce)` fallback.

**Trust-marker discipline** (per `PRODUCT.md` §8).
  - Every price example shows its price qualifier ("Offers in region of") adjacent.
  - Every valuation widget example shows "Indicative only".
  - Every personal-data form example shows the GDPR consent line.
  - Every rent f