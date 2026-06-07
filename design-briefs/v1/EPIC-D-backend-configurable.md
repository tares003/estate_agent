# EPIC-D — Backend configurable areas (design)

**Dev brief:** [dev-briefs/v1/EPIC-D-backend-configurable.md](../../dev-briefs/v1/EPIC-D-backend-configurable.md).
**Master spec reference:** Section D.
**Pack:** Core (with pack-dependent section types gated).
**Status:** NOT_STARTED.

## Surfaces affected

- Admin page-builder editor (the central CMS surface).
- Section-type catalogue picker (modal with thumbnail previews).
- Per-section editor pane (typed forms per section type).
- Preview pane (live preview with viewport toggles).
- Version history panel.
- Menu and footer editors.
- Email template editor.

## Layout patterns

- **Page builder:** split 60/40 desktop — left rail is sortable section list, right is live preview. Below `--breakpoint-lg`, switch to tabs (Sections / Preview).
- **Section list:** each item has a drag handle, the section-type name, a content preview, visibility toggle, edit and delete controls.
- **Section editor:** opens as a slide-over from the right. Heading, schema-driven form, save / cancel actions.
- **Preview pane:** toggles desktop / tablet / mobile. Always shows the unsaved draft.
- **Version history:** opens as a slide-over showing prior versions with author, timestamp, change summary and a "Restore" button.

## Component inventory

`AdminSidebar`, `AdminTopbar`, `AdminBreadcrumbs`, `AdminTable`, `AdminForm`, `RichTextEditor`, `Modal`, `Drawer`, `Toast`, `Tabs`, `Accordion`, plus a new `PageBuilder` organism and `SectionTypeRegistry` modal.

## State variations

- **Empty page:** "This page has no sections yet" plus a prominent "Add section" CTA.
- **Loading:** skeleton for both the section list and the preview pane.
- **Save in progress:** disable controls, show a small "Saving…" indicator in the topbar.
- **Save error:** inline error within the section editor, plus a toast for non-field-level errors.
- **Preview load error:** preview pane shows "Preview unavailable" with a retry button; section editing remains usable.

## Accessibility specifics

- Drag-and-drop has a keyboard equivalent (up/down arrow to move a section). Per `design-requirements.md` section 1.
- Schema-driven form fields use label association, error association and visible focus rings.
- The version-history list announces relative timestamps via `aria-label`.

## Responsive behaviour

- Page-builder split layout collapses to tabs below `--breakpoint-lg`.
- Section editor slide-over becomes full-screen on mobile.
- Preview pane viewport toggle still works on mobile.

## Motion

- Section reorder: drag preview opacity transitions per `--motion-duration-fast`.
- Slide-over open / close per `--motion-duration-base`.
- "Saving…" pulse on the topbar indicator per the skeleton-pulse rule.

## Token references

- Surface: `--colour-surface-raised` for the section list background.
- Border: `--colour-border` between list items.
- Accent on selected section: `--colour-brand-accent` background with `--colour-brand-accent-on` text.

## Open design questions

1. Confirm the visual treatment of the live preview pane (iframe inside the editor vs server-rendered HTML).
2. Confirm whether section types are searchable in the picker (recommended: yes, by typed name + tag).
3. Confirm the destructive-action confirmation pattern (a delete-section action — modal confirm or two-stage destructive button?).

## Pack-state behaviour

Per `design-requirements.md` §2a — the page-builder is the platform's richest pack-gated picker UI:

- **Section catalogue picker**: pack-dependent section types (developments grid, calculators embed, commercial property carousel, etc.) appear with a `PackLockPill` next to their label. The locked section types remain keyboard-focusable; activating one opens the pack-enable modal (not the section editor).
- **Editing a page that uses a now-disabled section**: if a tenant disables a pack while pages exist using that pack's section types, the section remains in the page-builder source data (no data destruction) but renders nothing on the public site. The admin editor shows a warning banner: "This section type requires the X pack. Re-enable to publish."
- **Per-section visibility flags**: a tenant on trial can preview pack-dependent sections; if the trial lapses without conversion, those sections fall back to the disabled-section warning state.
- **Email templates**: pack-aware welcome / trial / cancellation emails per `design-requirements.md` §2a.7. The email-template editor surfaces pack-specific variables.
