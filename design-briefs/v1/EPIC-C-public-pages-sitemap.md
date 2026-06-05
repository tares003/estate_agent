# EPIC-C — Public pages and sitemap (design)

**Dev brief:** [dev-briefs/v1/EPIC-C-public-pages-sitemap.md](../../dev-briefs/v1/EPIC-C-public-pages-sitemap.md).
**Master spec reference:** Section C.
**Status:** NOT_STARTED.

## Surfaces affected

- Portal homepage.
- Vertical landing pages (Sales, Tenants, Landlords, Sellers, New Homes, Commercial, Business Transfer, Care Homes).
- Team page with department filters.
- Locations index and area-guide detail pages.
- Knowledge hub index and article surface.
- Contact page.
- About page (optional).
- Branch pages.
- Legal pages (privacy, complaints, terms, cookies).

## Page-level patterns

- **Portal homepage:** decision splash, not a content page. Five (optional six) entry tiles laid out as a full-bleed grid on desktop and a vertical stack on mobile. Background photography or video. No filler content.
- **Vertical landing pages:** editorial structure — hero with strap line + search → three / four pillar block → introduction + secondary CTA → animated counter stats → introduction video → conversion strip (valuation, search, contact) → latest properties carousel → testimonials → optional sister-brand cross-promo → FAQs.
- **Locations:** tile grid of area cards. Hover lifts cards.
- **Area guide:** hero with strap line and image → about → transport → schools → amenities → "current properties in this area" carousel → testimonials filtered to that area → "thinking of selling here?" CTA.
- **Knowledge hub:** featured article → category filter → list with paginated cards → sidebar with popular and newsletter signup.
- **Contact:** address + per-department phones + per-department emails + business hours + general contact form + embedded map + office photo + social row.
- **Legal:** clean readable layout, no decoration, last-updated date at the top, table of contents on long pages.

## Component inventory (consumed from EPIC-L)

`Header`, `MobileMenu`, `Footer`, `StickyValuationCTA`, `ReviewsBadge`, `HeroSearch`, `HeroSection`, `HeroVideoSection`, `ThreePillarSection`, `FourPillarSection`, `TwoColumnSection`, `StatsCounter`, `TestimonialsCarousel`, `FAQAccordion`, `PartnerLogosRow`, `PropertyCarousel`, `PropertyCard`, `CTAStrip`, `ContactInfoBlock`, `CookieBanner`.

## State variations

- **Empty state on landing:** if a "latest properties" carousel has no eligible properties, render a CMS-managed placeholder block ("New listings coming soon") with a CTA to the catalogue.
- **Loading state:** skeleton matching final layout.
- **Error state:** if the carousel fails to load, render the CMS placeholder rather than an error message.
- **Success state:** form-success patterns are owned by EPIC-I; the public page just hosts the form.

## Accessibility specifics

- Skip-to-content link as the first focusable element.
- Hero strap-line text contrast must meet AA on the chosen photography. If a hero image would lower the contrast, the implementation overlays a darkened gradient.
- Carousel controls have visible labels (Prev / Next, image counter).
- FAQ accordion is keyboard-operable and announces expansion state.
- Cookie banner uses real buttons with focus rings and announces consent state changes.

## Responsive behaviour

- Hero typography scales down via the type-scale tokens, not by hand-tuning.
- Search bar collapses to a single-line input with a magnifier button below `--breakpoint-md`.
- Pillar blocks stack vertically below `--breakpoint-md`.
- Cards in carousels swipe with momentum scroll on touch devices.

## Motion

- Counter animation on intersection-observer entry per `motion-spec.md` section 4.
- Card hover lift per `motion-spec.md` section 4.
- Hero parallax only at `--breakpoint-md` and above, disabled under reduced-motion preference.

## Token references

- Colours: `--colour-brand-primary`, `--colour-brand-accent`, `--colour-surface-base`, `--colour-surface-raised`, every status token for cards.
- Type: full display scale, all body sizes, caption for badges.
- Spacing: section padding `--space-20` desktop / `--space-12` mobile; 24/16 px grid gutter.
- Radius: `--radius-md` for cards, `--radius-pill` for status badges.

## Open design questions

1. Confirm the visual treatment of the portal homepage — full-bleed video, full-bleed photography, or split-tile imagery?
2. Confirm whether the knowledge hub article surface is full-width or has a sidebar.
3. Confirm the legal-page typography — full-width prose or constrained reading width.
4. Confirm whether the testimonials block uses a carousel or a static three-quote layout.
