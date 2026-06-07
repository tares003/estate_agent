# EPIC-V — Outbound portal syndication (design)

**Dev brief:** [dev-briefs/v1/EPIC-V-portal-syndication.md](../../dev-briefs/v1/EPIC-V-portal-syndication.md).
**Master spec reference:** Section Q.7 (Phase 7).
**Pack:** `portal_syndication` (add-on).
**Status:** DEFERRED to Phase 7.

## Surfaces affected

- Admin → Integrations → Portal configuration screen (per portal).
- Admin → Property detail → Syndication status panel (per property).
- Admin → Reports → Syndication health (per branch).
- Property editor → Publish tab → "Syndicate to portals" toggle.
- Dashboard alerts → Syndication failure entries.

## Layout patterns

### Portal configuration screen

- One configuration tile per supported portal (Rightmove, Zoopla, OnTheMarket).
- Each tile is collapsible. Expanded view shows: connection status, last successful push, credentials (masked), feed schedule, branch identifier, per-portal property-status mapping.
- "Test connection" CTA on each tile.
- "Pause syndication" toggle per portal (audit-logged on use).

### Per-property syndication panel

- Compact table showing each enabled portal with: portal name and small logo (greyscale), portal listing ID (link out to the listing on the portal where available), last push timestamp, last push outcome, force-resync action.

### Syndication health report

- Per-branch overview chart: number of properties syndicated, number with sync failures in last 24 hours, average time-to-portal.
- Drilldown table: property reference, portal, last outcome, error message if any.

### Property editor syndication toggle

- Inside the Publish tab, a "Syndicate to portals" group with one checkbox per enabled portal. Disabled checkboxes carry a tooltip explaining why (e.g. "Vendor opted out", "Branch is paused for this portal").

## Component inventory

`PortalConfigTile`, `PortalSyncStatusPanel`, `SyndicationHealthChart`, `SyndicationDrilldownTable`, plus shared primitives.

## State variations

- **Portal not configured:** tile shows "Not connected" with a primary CTA to configure.
- **Connection failing:** tile shows red status badge with "Connection failed at [time]" and the error category.
- **Awaiting first push:** "Configured, awaiting next scheduled push at [time]".
- **Sync working normally:** green status, last successful push timestamp, "View health report" link.
- **Partial sync (some properties succeeded, some failed):** amber status, "View 3 failures" link.

## Accessibility

- Portal logos have meaningful `alt` text ("Rightmove logo").
- Status badges have `aria-label`.
- "Test connection" is a real button announcing "Testing…" via `aria-live`.

## Responsive

- Portal tiles stack vertically below `--breakpoint-md`.
- Sync status panel converts to a card list below `--breakpoint-md`.

## Motion

- "Testing connection…" spinner per skeleton-pulse rule.
- Status badge transitions follow standard pill transition.

## Token references

- `--colour-status-available` for healthy sync.
- `--colour-warning` for partial sync.
- `--colour-danger` for failed sync.

## Open design questions

1. Confirm whether portal logos are full-colour or greyscale by default (recommended: greyscale, full-colour on hover).
2. Confirm the visual treatment of paused-portal state (greyed-out tile vs explicit "Paused" badge).
3. Confirm whether the property editor lists every supported portal or only those the tenant has enabled.
