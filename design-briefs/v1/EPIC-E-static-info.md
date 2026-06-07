# EPIC-E — Static information areas (design)

**Dev brief:** [dev-briefs/v1/EPIC-E-static-info.md](../../dev-briefs/v1/EPIC-E-static-info.md).
**Master spec reference:** Section E.
**Pack:** Core.
**Status:** NOT_STARTED.

## Surfaces affected

- Public footer (regulatory strip, certificate badges).
- Settings → Site Info admin screen.

## Layout patterns

- **Footer regulatory strip:** small caption-size text on `--colour-surface-sunken` background. Company registration line, ICO number, regulatory scheme references.
- **Certificate badges:** horizontal row of greyscale badges with hover-tint to brand colour. Each badge links to the relevant certificate PDF in a new tab.
- **Site Info admin screen:** straightforward form with grouped sections (Company, Registration, Memberships, Trading address, Certificate uploads).

## State variations

- **Empty certificate:** no badge rendered if the corresponding certificate is missing.
- **Stale certificate (within 30 days of expiry):** admin alert on the dashboard.
- **Save success:** toast confirms; preview block above the form shows the new values.

## Accessibility

- Certificate badge alt text describes the membership (e.g. "Member of The Property Ombudsman").
- Footer regulatory text passes AA contrast on the chosen background.

## Responsive

- Footer regulatory strip wraps to two lines on mobile.
- Certificate badge row wraps to a 2-up grid on small screens.

## Motion

None beyond standard hover transitions.

## Token references

- `--text-caption` for regulatory strip.
- `--colour-text-muted` for the regulatory text colour.
- `--colour-surface-sunken` for the strip background.

## Open design questions

1. Confirm whether the platform operator's own legal entity needs a visible disclosure on tenant sites (sub-processor disclosure model).
2. Confirm the upload affordance for certificates (drag-drop zone vs file picker only).
