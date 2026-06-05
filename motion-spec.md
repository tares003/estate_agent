# MOTION SPEC — Animation, transition and motion requirements

This document is the authority for **how things move**. Every motion decision must reference a token from this document and behave per the rules described.

## 1. Motion principles

- **Motion serves comprehension, not decoration.** Every animation should help the user understand what just changed, where their attention should land, or what happens next.
- **Motion respects user intent.** When a user signals reduced-motion preference, all non-essential animation is replaced with an instant state change.
- **Motion is consistent.** Two surfaces that conceptually do the same thing (a modal opening, a chip toggling on) use the same duration and easing.
- **Motion never blocks input.** Animations finish in under one second for any state the user might want to interact with immediately.

## 2. Duration tokens

| Token | Milliseconds | Used for |
|---|---|---|
| `--motion-duration-instant` | 0 | Reduced-motion fallback |
| `--motion-duration-fast` | 150 | Hover transitions, focus ring appearance, button press |
| `--motion-duration-base` | 200 | Modal in/out, drawer slide, dropdown reveal, toast in |
| `--motion-duration-slow` | 400 | Page-section reveal on scroll, accordion expand |
| `--motion-duration-counter` | 1500 | Animated counter from 0 to target |
| `--motion-duration-gallery` | 250 | Property gallery slide |
| `--motion-duration-toast-out` | 200 | Toast dismiss |

## 3. Easing tokens

| Token | Curve | Used for |
|---|---|---|
| `--motion-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default for most in/out transitions |
| `--motion-ease-emphasis` | `cubic-bezier(0.16, 1, 0.3, 1)` | Slight overshoot — celebratory states only |
| `--motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Faster ease for elements leaving the viewport |
| `--motion-ease-linear` | `linear` | Progress bars, indeterminate loaders |

## 4. Per-component motion rules

### Buttons

- Background colour and box-shadow transition `--motion-duration-fast` `--motion-ease-standard` on hover.
- Focus ring fade in `--motion-duration-fast` `--motion-ease-standard`.
- Press state instant; release state `--motion-duration-fast`.

### Cards (property card, etc.)

- Hover lift: `transform: translateY(-2px)` over `--motion-duration-fast` `--motion-ease-standard`.
- Hover shadow: shadow elevation increase over the same duration.
- Click feedback: instant. No card-level press animation.

### Modals and drawers

- In: `--motion-duration-base` `--motion-ease-standard`. Scale from 0.96 to 1.0 with opacity 0 to 1.
- Out: `--motion-duration-base` `--motion-ease-exit`. Scale to 0.96 with opacity to 0.
- Backdrop fade matches the modal duration.
- Drawer slide: from the side over `--motion-duration-base`.

### Toasts

- In: from `translateY(8px)` and `opacity: 0` to rest over `--motion-duration-base` `--motion-ease-emphasis`.
- Out: opacity to 0 over `--motion-duration-toast-out` `--motion-ease-exit`.
- Auto-dismiss after 5 seconds by default; configurable per-toast.

### Dropdowns and popovers

- In: `opacity 0 → 1` and `translateY(-4px) → 0` over `--motion-duration-base` `--motion-ease-standard`.
- Out: reverse over `--motion-duration-fast` `--motion-ease-exit`.

### Property gallery

- Slide between images: `--motion-duration-gallery` `--motion-ease-standard`.
- Lightbox open: `--motion-duration-base` `--motion-ease-emphasis`.
- Pinch-zoom: real-time follow of gesture; no easing.

### Accordion / FAQ

- Expand: height animation from 0 to content height over `--motion-duration-slow` `--motion-ease-standard`.
- Collapse: reverse over `--motion-duration-base` `--motion-ease-exit`.

### Counter (animated stats)

- Triggered on intersection-observer entering the viewport.
- 0 to target over `--motion-duration-counter` `--motion-ease-standard`.
- Single play; does not re-animate on re-entry.

### Skeleton loaders

- Pulse animation: opacity from 0.4 to 0.8 and back, `1500ms` linear, infinite.

### Page transitions

- No page-level transition by default — full reloads happen at native browser speed.
- A subtle 80ms fade on view-transition-capable browsers is allowed but optional.

### Hero parallax (where allowed)

- Vertical parallax of background image at 40% of scroll speed on landing-page heroes only.
- Disabled at viewport widths below `--breakpoint-md` to preserve battery and performance on mobile.
- Disabled entirely when `prefers-reduced-motion: reduce`.

## 5. Reduced-motion behaviour

When the user's environment reports `prefers-reduced-motion: reduce`:

- All non-essential animations become instant state changes (use `--motion-duration-instant`).
- Parallax effects are disabled entirely.
- Counter animation does not animate — counters render at their target value.
- Hover lifts on cards do not animate but the elevation change is preserved as a colour or border-change cue.
- Skeleton loaders use a static dimmed state without the pulse.
- Modal and drawer open/close happen instantly.
- Toast still appears and disappears but without translation or fade.

## 6. Performance budget for motion

- Every animation must complete in under 1000 ms or be cancellable.
- No animation may pin the main thread (each frame must complete in 16 ms or less on a mid-range device).
- Avoid animating expensive properties (`width`, `top`, `left`); prefer `transform` and `opacity`.
- Animations on long lists (search results, CRM queue) must use windowing if more than 100 items might animate simultaneously.

## 7. Inappropriate motion

These animation patterns are not used on the platform:

- Bounce / spring effects on serious surfaces (admin, repair tickets, legal pages).
- Confetti on commercial actions (booking a viewing, submitting a valuation, completing a repair) — they trivialise the moment.
- Auto-playing video with sound on landing pages.
- Carousels that auto-advance without explicit user control.
- Cursor-following effects that don't serve a functional purpose.
- Hero text that animates in word by word.
