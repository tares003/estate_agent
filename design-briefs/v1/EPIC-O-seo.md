# EPIC-O — SEO (design)

**Dev brief:** [dev-briefs/v1/EPIC-O-seo.md](../../dev-briefs/v1/EPIC-O-seo.md).
**Master spec reference:** Section O.
**Status:** NOT_STARTED.

## Surfaces affected

- Admin SEO editor (per page, per property, per area guide, per blog post).
- SERP-preview component (live preview of how the page would appear in search results).
- OG-image preview component.
- Redirect-rules table (admin).

## Admin SEO editor

- Three-section editor:
  1. Meta title input with live character counter (≤ 60).
  2. Meta description input with live character counter (≤ 160).
  3. OG image picker — drag-drop or media-library pick. Preview at standard OG dimensions.
- A live SERP preview pane updates as the user types — showing the title, URL and description as Google would render.
- A "noindex" toggle with a small explainer ("This page won't appear in search results. Use sparingly.").
- A canonical URL override (advanced; collapsed by default).

## OG-image preview

- Renders the chosen OG image at 1200×630 with a watermark "Preview only".
- If no OG image is set, render the platform default OG image with the page title overlaid.

## Redirect-rules table

- Columns: From path / To path / Type (301 / 302 / 307 / 410) / Hits / Last hit.
- Add-rule form with path-syntax helper (wildcards allowed).
- Bulk import from CSV.
- "Detect-old-slug" automation: when a property or area-guide slug changes, the system automatically adds a row to this table.

## Component inventory

`SEOEditor`, `SERPPreview`, `OGImagePreview`, `RedirectRulesTable`.

## State variations

- **Loading SERP preview:** skeleton matching the SERP card.
- **Empty redirect rules:** "No redirects yet" with a "Why might I need this?" link.
- **Duplicate redirect:** when a new rule conflicts with an existing one, surface a warning before save.

## Accessibility

- Character counter is `aria-live="polite"` so screen readers announce length without spam.
- SERP preview has an aria-label describing the preview (since it's a visual mockup).

## Responsive

- Editor and preview stack vertically below `--breakpoint-lg`.
- Redirect table converts to stacked cards below `--breakpoint-md`.

## Motion

- Counter colour shift from neutral to amber to red as the input approaches and exceeds the recommended limit. Transition: `--motion-duration-fast`.

## Token references

- Character-counter warning colour: `--colour-warning`.
- Character-counter limit-exceeded: `--colour-danger`.

## Open design questions

1. Confirm whether per-page schema overrides have a UI in V1 (recommended: deferred to Phase 7).
2. Confirm whether the dynamic OG-image generator (e.g. property card rendered into the OG image) is in V1 (recommended: yes, with a default template).
