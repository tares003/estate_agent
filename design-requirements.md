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

## 3. Performance budgets

Tightly coupled to SEO (master spec Section O.5) and to per-tenant cost (Section S.2).

### Core Web Vitals targets

- **Largest Contentful Paint (LCP):** ≤ 2.5 seconds at the 75th percentile.
- **Interaction to Next Paint (INP):** ≤ 200 ms at the 75th percentile.
- **Cumulative Layout Shift (CLS):** ≤ 0.1 at the 75th percentile.

### Bundle budgets (per route, gzipped)

- **Public marketing routes:** JavaScript ≤ 150 KB, CSS ≤ 50 KB.
- **Property catalogue:** JavaScript ≤ 200 KB, CSS ≤ 60 KB.
- **Property detail:** JavaScript ≤ 220 KB, CSS ≤ 60 KB.
- **Admin shell:** JavaScript ≤ 350 KB (one-time load, code-split per section thereafter).
- **Customer account:** JavaScript ≤ 200 KB.

### Image performance

- WebP or AVIF first, JPEG fallback.
- `width` and `height` attributes mandatory on every image to prevent layout shift.
- `loading="lazy"` for any image below the fold.
- Only the LCP image (typically the property hero) uses `fetchpriority="high"`.
- Maximum source image dimension served on any viewport: 1920 px on the longest edge.
- Maximum file size for a single served property image: 500 KB at the largest variant.

### Font loading

- `font-display: swap` on every web-font face.
- One woff2 preloaded per family (display + body).
- Variable fonts preferred over multiple weight files where the family supports them.

### Third-party scripts

- Cookie-consent-gated. Nothing loads before consent.
- Maximum five third-party origins on any public page (analytics, error monitoring, reviews widget, anti-spam challenge, chat).
- Each third-party script must declare a `crossorigin` and `referrerpolicy` and use `defer` or `async` loading.

## 4. Internationalisation

- All user-facing text is sourced from translation keys, even when only English is shipped. This positions the platform for future locales without a refactor.
- Numbers, dates and currencies are formatted via the runtime's locale-aware formatters, never by hand.
- Right-to-left layouts are not in scope for V1 but the underlying styling system must support them when they arrive (`dir="rtl"` flips correctly).
- Property prices use the configured currency token; mixing of cur