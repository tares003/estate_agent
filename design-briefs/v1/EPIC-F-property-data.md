# EPIC-F — Property listing data (design)

**Dev brief:** [dev-briefs/v1/EPIC-F-property-data.md](../../dev-briefs/v1/EPIC-F-property-data.md).
**Master spec reference:** Section F.
**Pack:** Core (with new_homes, commercial, business_transfer, care_homes attributes gated by their packs).
**Status:** NOT_STARTED.

## Surfaces affected

- Admin property editor (9 tabs per master spec Section H.5).
- Admin property list (with filters, bulk actions, saved views).
- Public Property Card (universal — used in search results, landing carousels, related rails, saved-list).
- Public Property Hero (top of property detail page).
- Public Property Facts strip.
- Public Property Gallery (lightbox).
- Public Property Map.
- Public Property Nearby (transport + schools).
- Public Property Documents (floorplan, EPC, brochure thumbnails).
- Public Property Virtual Tour and Video embeds.
- Public Agent Card on property detail.
- Public Related Properties carousel.

## Layout patterns

### Admin property editor

- Left rail: 9 tabs with completion dots (Basics, Pricing, Specification, Location, Descriptions, Media, Agent, SEO, Publish).
- Main pane: tab content with grouped form sections.
- Right rail (Publish tab only): pre-flight checklist with green / red ticks.
- Sticky bottom bar: Save Draft / Publish / Preview-as-published.

### Public property card (universal)

- 4:3 image with status badge top-left, optional "+N photos" counter top-right.
- Address line in `--text-heading-sm`.
- Price in `--text-heading-md` with price qualifier above.
- Meta row in `--text-body-sm`: beds icon + count, baths icon + count, property type.
- "Added X ago" caption at bottom.
- Hover lifts 2 px and shadow elevates per `motion-spec.md`.

### Public property detail

Anatomy (top to bottom):

1. Status badge + address + property type + price.
2. Image hero with "View All" CTA + photo-count overlay.
3. Facts strip (icons): type · beds · baths · status · sqft.
4. Short description (1-2 sentences).
5. Key feature chips (3-10).
6. Action row: Book a Viewing / Contact Agent / Save Property.
7. Long description with "Read more".
8. Map.
9. Train stations nearby.
10. Schools nearby.
11. Booking sidebar (inline on desktop, modal on mobile).
12. Property Details table.
13. Floorplan thumbnail.
14. EPC thumbnail or "Coming soon" placeholder.
15. Virtual tour thumbnail.
16. Related Properties carousel.
17. Sticky valuation block.
18. Assigned agent card with inline message form.
19. Free valuation side block.

## Component inventory

`PropertyCard`, `PropertyGrid`, `PropertyCarousel`, `PropertyHero`, `PropertyGallery`, `PropertyFactsStrip`, `PropertyHeader`, `PropertyKeyFeatures`, `PropertyDescription`, `PropertyActions`, `PropertyMap`, `PropertyNearby`, `PropertyDocuments`, `PropertyVirtualTour`, `PropertyVideo`, `BookViewingForm`, `ContactAgentModal`, `AgentCard`, `PropertyDetailsTable`, `RelatedPropertiesCarousel`.

## State variations

- **Sold STC / Sold / Let agreed / Let:** status badge changes colour and label per `--colour-status-*` tokens; "Book a viewing" CTA disabled (replaced with "Notify me of similar").
- **No EPC uploaded:** EPC tile shows "Coming soon" placeholder.
- **No floorplan uploaded:** floorplan tile hidden entirely.
- **No virtual tour:** tile hidden.
- **No photos:** placeholder image with watermark; admin alert flags this.
- **Hide exact address:** map renders an offset marker and the address line uses postcode prefix only.

## Accessibility specifics

- Status badge has `aria-label` describing the status verbatim.
- Image gallery is keyboard-navigable: Esc to close, arrows to navigate.
- Map provides a textual fallback ("Map of [address]").
- "Read more" toggle changes accessible name from "Read more" to "Read less".
- Booking-form time-slot picker uses real radios under any custom visual.

## Responsive behaviour

- Above `--breakpoint-lg`: two-column layout (main content left, booking sidebar right).
- Below `--breakpoint-lg`: single column with sticky bottom action bar (Call / Book / Save).
- Hero gallery becomes full-bleed swipeable carousel below `--breakpoint-md`.

## Motion

- Hero gallery slide: `--motion-duration-gallery` `--motion-ease-standard`.
- Lightbox open / close: `--motion-duration-base` `--motion-ease-emphasis`.
- "Read more" expansion: `--motion-duration-base` `--motion-ease-standard`.

## Token references

Status badges use `--colour-status-*` tokens 1:1 with `market_status`. Cards use `--radius-md`. Gallery counter pill uses `--radius-pill`.

## Open design questions

1. Confirm whether sticky bottom action bar on mobile shows three or four actions.
2. Confirm the visual treatment of "+N photos" overlay (corner pill vs full-width gradient).
3. Confirm the placement of the assigned agent card on desktop (right rail vs bottom of detail).
4. Confirm whether key feature chips are rendered as plain pills or with icons (3-icon limit).

## Pack-state behaviour

Per `design-requirements.md` §2a — the property editor adapts to pack state at the attribute-group level:

- **Per-vertical attribute groups**: Commercial, Business Transfer, Care Home attribute groups appear in the editor only when their respective pack is enabled. When off, an inline `+ Add Commercial attributes` (etc.) affordance appears in the editor sidebar, opening the pack-enable modal on click.
- **Listing-type dropdown**: the `listing_type` field offers only the listing types whose owning pack is enabled, plus `residential` (always available in core).
- **Public property card**: a property created under a now-disabled listing_type remains in the database but does not appear in any public list, search result, or sitemap. The admin can still view and edit it; the card shows a "Pack required to publish" warning.
- **New-home-specific flags** (`is_new_home`, `is_off_plan`, `from_price` qualifier): only available when `new_homes` is enabled.
