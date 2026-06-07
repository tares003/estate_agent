# DESIGN REQUIREMENTS — Accessibility, responsiveness, performance

This document captures the **non-visual requirements** that constrain every design decision. These are universal; they apply to every component, every surface, every release.

## 0. UNIVERSAL MANDATES (no exceptions)

The three rules below are absolute. No component, no screen, no admin surface, no operator-tier admin, no email template is exempt. The CI guards reject any work that violates them.

1. **Every visual artefact must be fully responsive at every breakpoint defined in `DESIGN.md` §10** — from 320 px mobile through to 2,560 px wide-desktop. Mobile-first markup, progressive enhancement upward. A surface that "only works at desktop width" does not ship.
2. **Every interactive surface must meet WCAG 2.2 AA at every breakpoint.** Accessibility is not a desktop-only consideration; touch targets, focus management, label association, reduced-motion handling apply equally at every viewport.
3. **Every public route must meet the performance budget in §3** at every viewport, on a mid-range mobile device, on a 4G network, at the 75th percentile of real-user metrics.

A change that fails any of the three rules is not merged. A design that has not been verified at every breakpoint is not signed off. A component test suite missing a responsive variant is incomplete.

## 1. Accessibility

### Conformance target

- **Public surfaces:** WCAG 2.2 AA minimum, AAA on body-text contrast where achievable.
- **Admin surfaces:** WCAG 2.2 AA minimum.
- **Customer-account surfaces:** WCAG 2.2 AA minimum.

### Universal accessibility rules

1. Every interactive element must be reachable via keyboard.
2. Every interactive element must have a visible focus indicator (the focus ring defined in `DESIGN.md`).
3. Tab order must follow visual order.
4. Skip-to-content link must be the first focusable element on every page.
5. Every image must have meaningful alt text or `alt=""` if decorative.
6. Form fields must use `<label>` association (`for` / `id`) — not placeholder-only labels.
7. Form errors must be programmatically associated with their field via `aria-describedby` and announced via a polite live region.
8. Modals must trap focus, restore focus on close, and be dismissible via the Escape key.
9. Custom interactive components must expose the correct ARIA role and state attributes.
10. Status badges must include an `aria-label` describing the status — colour alone is not a state signal.
11. Time-slot selectors must use real radio inputs underneath any custom visual layer.
12. Drag-and-drop interfaces must offer a keyboard equivalent (e.g. up/down arrows to reorder).
13. Live-updating regions (live chat, ticket activity feed) must use `aria-live` with `polite` or `assertive` as appropriate.
14. Video controls must be keyboard-operable and offer captions or transcripts where the video is content-bearing.
15. The map component must offer a textual fallback (`Map of [address]`) for screen-reader users.

### Contrast requirements

- Body text against any background: at least 4.5:1 contrast ratio (WCAG AA).
- Large text (24px+ regular or 18.66px+ bold): at least 3:1.
- Interactive UI components and graphical objects: at least 3:1 against their adjacent colours.

### Reduced-motion respect

- See `motion-spec.md` section 5.

## 2. Responsive behaviour

Responsive design is the **first rule** of this project (see §0). Every artefact must work, look right and behave correctly at every breakpoint from 320 px through to 2,560 px wide-desktop. "It works on my laptop" is not a sign-off criterion.

### Breakpoints

Defined in `DESIGN.md` §10. Five primary breakpoints: `--breakpoint-sm` (640), `--breakpoint-md` (768), `--breakpoint-lg` (1024), `--breakpoint-xl` (1280), `--breakpoint-2xl` (1440). Every design surface must be verified at each.

### Universal responsive rules

- **Mobile-first.** Default styles target the smallest viewport (320 px). Media queries widen up. Never the other way around.
- **Verified at every breakpoint.** Every component, every page, every admin surface, every operator surface, every email template, every PDF — verified at 320, 640, 768, 1024, 1280, 1440 and 2560 px before sign-off.
- **No horizontal scroll** on any viewport from 320 px upwards except inside table containers that are explicitly horizontally scrollable with a visual cue.
- **Touch targets.** Every interactive target is at least `--size-touch-target-min` (44 px) in both dimensions on touch devices, regardless of viewport width.
- **Hit areas extend beyond visual boundaries** where the visual target is small (icons under 24 px).
- **Single-column on small.** Forms, property detail content, dashboards, admin tables collapse to a single column or stacked-card layout at `<= --breakpoint-md`. Multi-column layouts are an enhancement above that, never a requirement.
- **Content-priority on small.** When space runs out, lower-priority content collapses, hides or moves below — never the primary action.
- **Touch + mouse + keyboard** — every breakpoint supports every input mode. Hover-only interactions are forbidden because they don't work on touch.

### Surface-specific responsive rules

- **Header:** desktop nav collapses to logo + hamburger + tel icon below `--breakpoint-md`.
- **Property card:** image becomes full-width; meta row stays single-line with truncation.
- **Property detail:** image hero becomes a full-width swipeable carousel; sticky bottom action bar appears with Call / Book Viewing / Save actions.
- **Filters bar:** advanced filters drawer opens from the bottom on mobile, side on desktop.
- **Forms:** stack to a single column on mobile; time-slot selectors become large tappable cards.
- **Admin tables:** convert to stacked cards below `--breakpoint-md` with the most-important column promoted to the title.
- **Calendar:** day view by default on mobile; week view default from `--breakpoint-lg` upward.

## 2a. Modular product — pack-state design patterns

The platform is a **modular product**: a tenant agency's enabled feature packs (per `PRODUCT.md` §5a) determine which screens, components, capabilities and public surfaces are active. Every brief in this repo carries a `**Pack:**` header that names its owning pack.

Surfaces that depend on pack state — admin sections, page-builder section types, property-editor attribute groups, public verticals, customer-portal entry points — all use a **single, consistent visual vocabulary** so that the user (whether tenant operator, agency staff member, applicant, vendor or landlord) is never confused about why a surface is or isn't available. The patterns below are universal; every design brief inherits them by reference.

### 2a.1 The "locked admin section" pattern

When a tenant operator (or any authenticated tenant-side user) navigates to an admin section their pack does not include — for example `/admin/feedback` without the `feedback_reviews` pack, or `/admin/vendors` without `sales_plus` — they shall **not** see a 404 or a "permission denied" error. They shall see a branded **upsell empty state**:

- Pack name and what it enables, in plain language.
- A representative illustration or screenshot (CMS-managed per tenant theme).
- The pack's monthly cost.
- A primary CTA "Enable for £X / month" that opens the pack-enable modal directly (per EPIC-AD design brief).
- A secondary "Learn more" link to the pack's marketing page.

This pattern uses the `UpsellEmptyState` component (EPIC-L). The component is responsive at every breakpoint per Section 0.

### 2a.2 The "pack-gated catalogue" pattern

In any **picker / catalogue / palette** UI where the user chooses an item from a set — the page-builder section catalogue (EPIC-D), the form-builder field palette (EPIC-H), the notification-rule event picker (EPIC-H), the page-builder layout picker, the workflow-automation trigger picker — items that depend on a pack the tenant doesn't have shall be **shown** (not hidden) with a `PackLockPill` (EPIC-L) adjacent to the item:

- `🔒 Requires New Homes pack`.
- The locked item is keyboard-focusable but its primary action is replaced.
