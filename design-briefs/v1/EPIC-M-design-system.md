# EPIC-M — UX and visual design system (design)

**Dev brief:** [dev-briefs/v1/EPIC-M-design-system.md](../../dev-briefs/v1/EPIC-M-design-system.md).
**Master spec reference:** Section M.
**Pack:** Core.
**Status:** NOT_STARTED.

## Purpose

Confirm and finalise the token set in `DESIGN.md`, set up the canvas styles that reference those tokens, and produce the theme-editor design.

## Sprint 01 deliverable

- Confirm token values against the brand decision. Update `DESIGN.md` if anything changes.
- Stand up the design canvas (in whichever tool is chosen) with token-driven styles.
- Define every primitive in EPIC-L as a canvas entry.
- Design the theme-editor admin screen (master spec Section H.11).

## Theme-editor design

- **Logo upload zone:** drag-drop with preview at multiple sizes (header, mobile, favicon, OG default, email header).
- **Colour pickers:** brand-primary, brand-accent, brand-primary-on, brand-accent-on. Each picker shows live AA / AAA contrast indicator against the matched "on" colour.
- **Typography pickers:** display family, body family. Live preview using sample copy.
- **Spacing scale chooser:** compact / default / spacious — radio cards with sample layout previews.
- **Component preset choosers:** button radius, card radius, input radius — radio cards.
- **Live preview pane:** sample property card, sample landing-page hero, sample form. Updates instantly on any change.
- **Save / discard:** sticky bottom bar. Save persists the override; Discard reverts to the platform default.

## State variations

- **Contrast warning:** if a chosen combination fails AA contrast, surface a warning beside the picker and require an "Override anyway" toggle.
- **Save in progress:** disable controls, show "Saving theme…" indicator.
- **Save success:** toast confirms, live preview shows the saved state.

## Accessibility specifics

- Colour pickers are keyboard-operable (hex input as fallback).
- Contrast warning has `role="alert"` when it first appears.

## Responsive

- Theme editor is desktop-focused. On mobile, the live preview pane stacks below the controls.

## Motion

- Live preview updates without a transition (immediate reflection of state).
- Save success toast per standard toast rules.

## Open design questions

1. Confirm the final token values for brand colours and typography.
2. Confirm the scope of font choices (a curated list of 10-20 families vs free choice from Google Fonts).
3. Confirm whether the live preview pane includes the full property detail surface or only key snippets.
