# DESIGN REQUIREMENTS — Accessibility, responsiveness, performance

This document captures the **non-visual requirements** that constrain every design decision. These are universal; they apply to every component, every surface, every release.

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

### Breakpoints

Defined in `DESIGN.md` section 10. Layout rules:

- **Mobile-first.** Default styles target the smallest viewport; media queries widen up.
- **Single-column on small.** Forms, property detail content, dashboards collapse to one column at `<= --breakpoint-md`.
- **Touch targets.** Every interactive target is at least `--size-touch-target-min` (44 px) in both dimensions on touch devices.
- **No horizontal scroll** on any viewport from 320 px upwards except inside table containers that are explicitly horizontally scrollable with a visual cue.
- **Hit areas extend beyond visual boundaries** where the visual target is small (icons under 24 px).

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
- Property prices use the configured currency token; mixing of currencies on one tenant's site is not supported.

## 5. Print

- Property detail pages must produce a clean printed page (background colours off, gallery collapsed to a small grid, agent contact prominent).
- Admin screens are not print-optimised.

## 6. Browser support

| Browser | Versions supported |
|---|---|
| Chrome | Current and previous two major releases |
| Safari | Current and previous major release |
| Firefox | Current and previous two major releases |
| Edge | Current |
| iOS Safari | Current and previous major release |
| Android Chrome | Current and previous major release |

No support for browsers older than this. A polite "your browser is too old" overlay shows on detected unsupported browsers.

## 7. Empty, loading, error and success states

Every interactive surface must define its behaviour in all four states.

- **Empty state:** clearly explains why the surface is empty and offers the next useful action.
- **Loading state:** skeleton matches the final layout's shape (no spinners on content surfaces).
- **Error state:** plain language, no jargon, no error codes by default. Offer the user a retry, or a way to contact support if retry is impossible.
- **Success state:** confirms the action and surfaces the next relevant action.

Each of these is captured as a story-level acceptance criterion in every dev brief.

## 8. Content guidelines for designers

- Default to **dense, scannable** layouts in the admin; default to **generous, editorial** layouts on the public site.
- Headings shrink with depth — never larger inside than the page title.
- Buttons describe the action verb-first ("Save changes", "Send enquiry"), never "OK" or "Submit" except where unavoidable.
- Forms never submit without explicit user action; auto-submit is not used.
- Long lists always offer search and filter at the top.

## 9. Authority and amendment

- This document is part of the foundation set. Amendments require review.
- Conformance to this document is verified by automated checks in the CI pipeline (the checks themselves are described in `dev-briefs/sprint-01/_cross-cutting.md`).
- If this document and the master spec disagree, the master spec wins for behaviour; this document wins for accessibility and performance constraints.
