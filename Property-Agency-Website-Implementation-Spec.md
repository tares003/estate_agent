# Property Agency Website — Full Implementation Specification

**Document type:** Developer-ready implementation brief
**Target persona:** A senior full-stack engineer (or small team) building the platform end-to-end
**Inspiration / reference site:** A multi-vertical Essex-based estate agency operating across Sales, Lettings, New Homes, Commercial, Business Transfer and a niche Care Homes vertical. The reference site is a federated stack — its property catalogue, tenant maintenance, instant valuations and knowledge hub are each served by separate specialist products. This specification assumes the platform is **being built first-party**, while flagging the build-vs-integrate decision per module so that the team can choose to integrate established products where appropriate.
**Originality note:** No copyrighted text, image, brand mark or copy from the reference site is reproduced anywhere in this document. The structure, workflow and feature taxonomy are recreated from first principles.
**Document conventions:** This document is a **requirements specification**. It describes what the system must do, what information it must capture, what user journeys it must support, and what non-functional qualities (performance, security, availability, cost, compliance) it must meet. It deliberately does not name a specific web framework, language, database product, hosting provider or vendor. Those choices are implementation decisions to be made by the engineering team once the requirements are agreed. "Must / Should / Nice" indicates priority. The final deliverable is one product, not multiple — even where the reference site uses sub-domains.

---

## Table of Contents

A. [Executive summary](#a-executive-summary)
B. [Website feature audit](#b-website-feature-audit)
C. [Public pages and sitemap](#c-public-pages-and-sitemap)
D. [Backend configurable areas (CMS)](#d-backend-configurable-areas-cms)
E. [Static information areas](#e-static-information-areas)
F. [Property listing data model](#f-property-listing-data-model)
G. [Repair system specification](#g-repair-system-specification)
H. [Admin dashboard specification](#h-admin-dashboard-specification)
I. [CRM and lead workflow](#i-crm-and-lead-workflow)
J. [Database schema](#j-database-schema)
K. [API endpoint list](#k-api-endpoint-list)
L. [Frontend components](#l-frontend-components)
M. [UX and visual design system](#m-ux-and-visual-design-system)
N. [Security and GDPR checklist](#n-security-and-gdpr-checklist)
O. [SEO checklist](#o-seo-checklist)
P. [Recommended tech stack](#p-recommended-tech-stack)
Q. [Build roadmap](#q-build-roadmap)
R. [Developer-ready implementation brief](#r-developer-ready-implementation-brief)
S. [Non-functional requirements for hosting and multi-tenancy](#s-non-functional-requirements-for-hosting-and-multi-tenancy)

---

## A. Executive summary

You are building a **multi-vertical property agency platform** consisting of seven logically distinct surfaces that ship as one product:

1. **A portal-style marketing site** that funnels visitors into five (optionally six) verticals — Buyers (Sales), Tenants (Lettings), Sellers, Landlords, New Homes, Commercial, Business Transfer and an optional Care Homes vertical. The portal homepage is intentionally a *splash decision page*, not a content-heavy landing page; conversion happens on the vertical landing pages downstream.
2. **A unified property catalogue** served from a single `/properties` route. A `sale_type` toggle (buy / rent) and a `listing_type` filter (residential / commercial / business / new home) determine which sub-set is displayed. The same data model powers Sales, Lettings, New Homes, Commercial and Business Transfer.
3. **A registered-user account area** providing saved properties, saved searches with email alerts, and viewing history. A persistent "Sign Up Now" banner inside the results grid is the primary acquisition surface.
4. **An admin dashboard** for staff covering property lifecycle, lead management, viewing & valuation calendars, repair tickets, CMS editing, team and branch management, and SEO/settings.
5. **A repair / maintenance reporting system** with a tenant-facing intake form (photo uploads, urgency, access permission) and an internal ticket workflow with statuses, contractor assignment and audit trail.
6. **A CRM** that consolidates every lead source — buyer enquiry, seller valuation, tenant enquiry, landlord enquiry, viewing request, repair request, general contact, career enquiry — into one queue with assignment, status, priority, follow-up dates and notes.
7. **A headless CMS layer** driven by a page-builder model: every editorial page is an ordered list of typed sections, each rendering a re-usable interface component.

**Key architectural decisions baked into this spec:**

- A single `properties` table with a `listing_type` discriminator (residential / new_home / commercial / business / care_home / land) — *not* a separate table per vertical. This keeps search unified.
- A single `enquiries` table with a `lead_type` discriminator covering all eight enquiry types — *not* one table per form. The CRM queue is therefore one query, not eight.
- A page-builder CMS (`pages` ⇒ `page_sections[]` with typed JSON payloads) — *not* hard-coded marketing pages. Every editorial page is editable without a deploy.
- A federation-friendly design that can later swap individual modules (repairs, valuations, property data) for established third-party products without re-architecting.
- Implementation-neutral interface contracts so the same back-end can serve a web application, a future mobile application, or an embeddable widget.
- **Every visual surface of the platform is fully responsive at every breakpoint from 320 px to 2,560 px.** Public marketing, property catalogue, property detail, customer-account, all administrative surfaces, all portal surfaces (vendor / landlord / tenant), all platform-operator surfaces, all email templates, all modals and overlays. There is no "desktop-only" screen anywhere in this product. Mobile-first markup, touch + mouse + keyboard at every viewport, no hover-only interactions, no horizontal scroll. The technical mandate lives in `design-requirements.md` §0 and §2; the CI guard G11 in `dev-briefs/sprint-01/_cross-cutting.md` §4 enforces it.

**Out of scope (deliberately):**

- Mortgage origination or pre-qualification beyond a basic calculator
- Stamp Duty paperwork beyond an indicative calculator
- Tenancy contract generation (defer to a specialist contract-generation product)
- Open Banking rent collection (defer to a specialist payments product)
- Identity & AML checks for tenants (defer to a specialist referencing / compliance product)
- Conveyancing portal (defer to a specialist conveyancing-tracking product)

Each is called out in the integrations table in Section P.

---

## B. Website feature audit

This is the canonical feature inventory. Read it once end-to-end; later sections refer back to it by feature number.

Legend — **Priority:** M = Must, S = Should, N = Nice. **Backend?:** does the feature need server-side logic. **Admin?:** can a non-developer configure it from the dashboard.

| #  | Feature                              | Where it appears                                         | User action                                              | What happens                                                                                       | Backend? | Admin? | Tables involved                                                | Priority | Implementation approach                                                                              |
|----|--------------------------------------|----------------------------------------------------------|----------------------------------------------------------|----------------------------------------------------------------------------------------------------|---------|--------|---------------------------------------------------------------|---------|------------------------------------------------------------------------------------------------------|
| 1  | Portal splash homepage               | `/`                                                      | Pick one of N verticals                                  | Routes user to vertical landing page; analytics event logged                                       | Light    | Yes    | `pages`, `page_sections`, `settings`                          | M       | SSR page with a CMS-driven panel array; client-side click event posted to analytics                  |
| 2  | Vertical landing pages               | `/sales`, `/tenants`, `/landlords`, `/sell-your-home`, `/new-homes`, `/commercial`, `/business-transfer`, `/care-homes` | Browse hero, search, scroll content, submit form         | User reads marketing content and either searches or converts via a form                            | Yes      | Yes    | `pages`, `page_sections`, `properties`, `testimonials`, `faqs`| M       | Page-builder model — each page is an ordered list of typed sections                                  |
| 3  | Sticky utility bar (phone / reviews) | Global header strip                                      | Click phone, reviews link, WhatsApp                      | Tel/WhatsApp deep-link or external review widget                                                   | No       | Yes    | `settings`                                                    | M       | Floating action bar component reading from `settings`                                                |
| 4  | Hero search bar                      | Landing pages and `/properties`                          | Type location/postcode, submit                           | Navigates to `/properties?location=…&sale_type=…&listing_type=…`                                   | Yes      | Yes    | `search_logs`                                                 | M       | Client-side typeahead → URL params → SSR results                                                     |
| 5  | Property catalogue / search          | `/properties`                                            | Toggle Buy/Rent, choose filters, sort, paginate          | Returns filtered list                                                                              | Yes      | Yes    | `properties`, `property_images`                               | M       | `GET /api/properties` with query params; SSR with ISR or stale-while-revalidate                       |
| 6  | Property card (unified)              | Search results, vertical landing carousels, related list | Click card                                               | Opens property detail page                                                                         | Read     | Yes    | `properties`, `property_images`                               | M       | Reusable component; image lazy-load; status badge driven by `market_status`                          |
| 7  | Property detail page                 | `/properties/[slug]`                                     | View photos, read, save, book viewing, contact agent     | Triggers multiple downstream CTAs                                                                  | Yes      | Yes    | `properties`, `property_images`, `property_documents`, `agents`, `viewing_requests`, `enquiries`, `saved_properties` | M | SSR + client-side gallery & forms; ISR for re-validation                                              |
| 8  | Image gallery / lightbox             | Property detail                                          | Click image, swipe, see "+N photos"                      | Modal gallery with keyboard nav and pinch-zoom                                                     | No       | n/a    | `property_images`                                             | M       | Lightbox component (a JavaScript lightbox component)                                |
| 9  | Floorplan viewer                     | Property detail                                          | Click thumbnail                                          | Opens floorplan image / PDF                                                                        | No       | Yes    | `property_documents` (type=floorplan)                         | M       | Image or PDF.js embed                                                                                |
| 10 | EPC viewer                           | Property detail                                          | Click thumbnail                                          | Opens EPC certificate or shows "Coming soon"                                                       | No       | Yes    | `property_documents` (type=epc)                               | M       | Image or PDF embed; fallback placeholder                                                             |
| 11 | Brochure download                    | Property detail                                          | Click "Download brochure"                                | PDF download (optionally gated behind email capture)                                               | Yes      | Yes    | `property_documents`, `enquiries`                             | S       | Pre-generated PDF or on-demand server-side render                                                    |
| 12 | Video tour                           | Property detail                                          | Click play                                               | Embedded YouTube / Vimeo / self-hosted MP4                                                         | No       | Yes    | `properties.video_url`                                        | S       | iframe / `<video>` embed                                                                             |
| 13 | 360° virtual tour                    | Property detail                                          | Click virtual tour                                       | iframe to Matterport / Kuula / GiraffeXR                                                           | No       | Yes    | `properties.virtual_tour_url`                                 | S       | iframe embed                                                                                         |
| 14 | Map location                         | Property detail, contact, area guides                    | Pan / zoom                                               | Renders interactive map with marker                                                                | No       | Yes    | `properties`, `branches`, `area_guides`                       | M       | an interactive vector-tile map provider                                                              |
| 15 | Train stations & schools nearby      | Property detail                                          | View                                                     | Lists nearby POIs with distances                                                                   | Yes      | Auto + manual override | `properties`, external API                                  | S       | Cache server-side responses from a map-search API and the Ofsted dataset                            |
| 16 | "Save property" heart                | Property card & detail                                   | Click heart (requires login)                             | Persists to `saved_properties`; heart fills                                                        | Yes      | n/a    | `saved_properties`, `users`                                   | S       | Auth-gated POST; optimistic UI                                                                       |
| 17 | Property sort                        | `/properties`                                            | Choose dropdown                                          | Re-queries with `sort` param                                                                       | Yes      | n/a    | n/a                                                           | M       | URL param `sort=newest|oldest|price_asc|price_desc`                                                  |
| 18 | Sale / Rent toggle                   | `/properties`                                            | Toggle Buy / Rent                                        | Re-queries with `sale_type`                                                                        | Yes      | n/a    | n/a                                                           | M       | URL param-driven filter                                                                              |
| 19 | Search filters                       | `/properties`                                            | Choose price, beds, baths, type, area, added-date, "include Sold STC / Let Agreed", "new homes only" | Re-queries                                                                                         | Yes      | Yes    | `properties`                                                  | M       | Query-string driven; URL is source of truth                                                          |
| 20 | Pagination                           | `/properties`                                            | Click page                                               | Loads next page                                                                                    | Yes      | Yes    | n/a                                                           | M       | Cursor or offset-based; page size configurable                                                       |
| 21 | Saved search + email alerts          | `/properties` (logged-in only)                           | Save current filters; receive email alerts at a cadence  | Persists; daily/weekly cron emails new matches                                                     | Yes      | Yes    | `saved_searches`, `users`, `notification_log`                 | S       | Cron job + email template; user can pause / unsubscribe                                              |
| 22 | Registration / sign-up               | `/register`                                              | Submit name, email, password                             | Account created; email-verify mail sent                                                            | Yes      | Yes    | `users`                                                       | S       | managed authentication with a memory-hard password hash                                                              |
| 23 | Login                                | `/login`                                                 | Email + password (or social)                             | Session created                                                                                    | Yes      | Yes    | `users`, `sessions`                                           | S       | Session cookie or JWT-in-httpOnly                                                                    |
| 24 | Customer account                     | `/account`                                               | View saved properties, saved searches, viewing history, profile, alerts settings | Account dashboard                                                                                  | Yes      | n/a    | `users`, `saved_*`, `viewing_requests`                        | S       | Authenticated SPA-style area                                                                         |
| 25 | Book a viewing                       | Property detail, modal                                   | Name, email, phone, date, time-slot                      | Lead + viewing request created; email to assigned agent + branch; confirmation + ICS to applicant  | Yes      | Yes    | `viewing_requests`, `properties`, `agents`, `enquiries`, `email_templates` | M | Time-slot bands configurable; ICS file attached to confirmation                                       |
| 26 | Property enquiry                     | Property detail                                          | Submit message + contact info                            | Lead created; email to assigned agent + branch; confirmation to user                               | Yes      | Yes    | `enquiries`, `email_templates`                                | M       | One enquiry endpoint, type=`property_enquiry`                                                        |
| 27 | Instant valuation request            | `/sell-your-home`, sticky CTAs, side tab                 | Address + contact + property details (multi-step)        | Lead created; optional automatic indicative valuation; email to valuations@                        | Yes      | Yes    | `valuation_requests`, `enquiries`, `email_templates`          | M       | Multi-step wizard; optional integration with Land Registry and an automated-valuation provider                         |
| 28 | Landlord enquiry                     | `/landlords`                                             | Submit address, current status, message                  | Lead + email                                                                                        | Yes      | Yes    | `enquiries (type=landlord)`, `landlords`                      | M       | Form → CRM, may create a draft `landlords` record                                                    |
| 29 | Tenant enquiry / pre-qualification   | `/tenants`                                               | Submit budget, move-in date, message                     | Lead + email                                                                                        | Yes      | Yes    | `enquiries (type=tenant)`                                     | M       | Form → CRM                                                                                            |
| 30 | Repair / maintenance request         | `/tenants/report-repair` (linked "Report Now")           | Multi-step form with photo upload                        | Ticket created; email to property manager + branch; SMS for emergencies; ticket number to tenant   | Yes      | Yes    | `repair_requests`, `repair_files`, `enquiries`                | M       | Multipart upload to object storage; status workflow                                                  |
| 31 | Contact form                         | `/contact`                                               | Name, email, phone, department, message                  | Lead + email to right department                                                                   | Yes      | Yes    | `enquiries (type=general)`                                    | M       | Department-routed `to` address                                                                       |
| 32 | Careers application                  | `/careers` (or external feed)                            | Name, email, role, CV upload, cover letter, GDPR consent | Stored + emailed to HR                                                                              | Yes      | Yes    | `enquiries (type=career)`, `applications`                     | S       | Optional external Indeed/Workable feed                                                               |
| 33 | Newsletter signup                    | Footer + inline                                          | Email submit; optional first name                        | Subscribed; double opt-in email                                                                    | Yes      | Yes    | `subscribers`                                                 | S       | a managed newsletter / audience product with double opt-in                                                                |
| 34 | FAQs accordion                       | Vertical landing pages                                   | Expand                                                   | Shows answer                                                                                       | No (CMS) | Yes    | `faqs`                                                        | M       | CMS-driven, per-vertical taxonomy                                                                    |
| 35 | Animated stats counters              | Vertical pages                                           | Scroll into view                                         | Count up from 0 to target                                                                          | No       | Yes    | `page_sections`                                               | S       | IntersectionObserver + `requestAnimationFrame`                                                       |
| 36 | Reviews widget                       | "4.9 / 5 from 1k+ reviews" badge                         | Click                                                    | External link to Google / Trustpilot / Reviews.io page                                              | Yes      | Yes    | `settings`                                                    | S       | Fetch latest rating on a cron; cache                                                                  |
| 37 | Team page with role filter           | `/team`                                                  | Filter chips by department                               | Filtered grid                                                                                      | Yes (CMS)| Yes    | `agents`, `agent_departments`                                 | M       | Static filter chips with optimistic UI                                                                |
| 38 | Team profile modal                   | `/team`                                                  | Click member                                             | Modal with bio, photo, contact, social                                                              | Yes      | Yes    | `agents`                                                      | S       | Modal route (`/team/[slug]`) or in-place modal                                                       |
| 39 | Locations index                      | `/locations`                                             | Browse tiles                                             | Lists area cards                                                                                   | Yes (CMS)| Yes    | `area_guides`                                                 | M       | CMS-driven grid                                                                                       |
| 40 | Area guide page                      | `/locations/[slug]` (or SEO-friendly `/houses-for-sale-[slug]`) | Read area guide, see local properties                  | Area page with linked properties query                                                              | Yes      | Yes    | `area_guides`, `properties`                                   | M       | CMS + filtered properties query                                                                       |
| 41 | Knowledge hub (blog)                 | `/news`, `/news/[slug]`                                  | Browse, filter by category/tag, read                     | Article list + detail                                                                              | Yes (CMS)| Yes    | `blog_posts`, `blog_categories`, `blog_tags`, `blog_authors`  | M       | MDX or block-based rich text in CMS                                                                   |
| 42 | RSS feed                             | `/feed.xml`                                              | n/a                                                      | RSS / Atom feed of latest posts                                                                    | Yes      | Auto   | n/a                                                           | S       | Generated on the fly                                                                                  |
| 43 | Sister-brand cross-promo block       | Sales landing page                                       | Click external link                                      | Opens sister brand (e.g. luxury/off-market site)                                                    | No       | Yes    | `settings`                                                    | S       | CMS-managed block                                                                                     |
| 44 | Privacy / Complaints / Terms / Cookies pages | `/privacy`, `/complaints`, `/terms`, `/cookies`     | Read                                                     | Static legal content                                                                               | No (CMS) | Yes    | `pages`                                                       | M       | CMS rich text                                                                                         |
| 45 | Cookie banner                        | Global                                                   | Accept / reject categories                               | Persists consent; conditionally loads analytics / pixel / chat scripts                              | Yes      | Yes    | `consent_logs`                                                | M       | Self-host (a self-hosted consent banner) or a managed consent-management product                                                |
| 46 | Social media links                   | Footer + global                                          | Click                                                    | External                                                                                            | No       | Yes    | `settings`                                                    | M       | Settings table                                                                                        |
| 47 | Certificate / membership badges      | Footer (Ombudsman, ICO, Propertymark, etc.)              | Click                                                    | PDF download of certificate                                                                        | No       | Yes (uploads) | `media`, `settings`                                       | S       | CMS-managed PDF files                                                                                 |
| 48 | SEO meta per page                    | All pages                                                | n/a                                                      | Renders OG, meta description, canonical                                                            | Yes      | Yes    | `seo_metadata`                                                | M       | Per-page DB override with sensible default                                                            |
| 49 | Schema.org RealEstateListing JSON-LD | Property detail                                          | n/a                                                      | Structured data emitted                                                                            | Yes      | Auto   | n/a                                                           | M       | `<script type="application/ld+json">` injection                                                       |
| 50 | XML sitemap                          | `/sitemap.xml` (+ child sitemaps)                        | n/a                                                      | Generated                                                                                          | Yes      | Auto   | n/a                                                           | M       | a server-rendered sitemap or static generator                                                             |
| 51 | Robots.txt                           | `/robots.txt`                                            | n/a                                                      | Generated                                                                                          | Yes      | Auto   | n/a                                                           | M       | Static or dynamic route                                                                               |
| 52 | Admin dashboard                      | `/admin`                                                 | Login + manage everything                                | Full CRUD over CMS + leads + properties                                                            | Yes      | n/a    | All tables                                                    | M       | Protected app; see section H                                                                          |
| 53 | Analytics                            | Global                                                   | n/a                                                      | Page-view + event tracking                                                                          | Yes      | Yes    | n/a                                                           | M       | a cookie-consent-gated analytics product (or pair: aggregate + product analytics)                                                      |
| 54 | Live chat / WhatsApp                 | Floating button                                          | Open chat                                                | wa.me deep link OR a chat-widget product widget                                                       | No       | Yes    | `settings`                                                    | S       | Settings flag chooses provider                                                                        |
| 55 | Reorderable property image gallery (admin) | Admin property edit                                 | Drag/drop                                                | Persists `sort_order`                                                                              | Yes      | n/a    | `property_images.sort_order`                                  | M       | a drag-and-drop UI library                                                                        |
| 56 | Bulk property import                 | Admin                                                    | Upload XML/CSV, or schedule feed pull                    | Bulk insert/update                                                                                 | Yes      | n/a    | `properties`, `import_logs`                                   | S       | portal-feed XML parser; idempotent upserts on `external_id`                      |
| 57 | Audit log                            | Admin                                                    | View who-did-what                                        | Lists changes                                                                                      | Yes      | n/a    | `audit_logs`                                                  | S       | application-middleware-driven audit logging                                                                  |
| 58 | Stamp Duty calculator                | Sellers / Buyers page                                    | Enter price, buyer status                                | Indicative figure                                                                                  | No       | Yes (bands) | `settings.stamp_duty_bands`                                | S       | Client-side calc with admin-editable bands                                                            |
| 59 | Mortgage calculator                  | Buyers / Property detail                                 | Enter price, deposit, rate, term                         | Indicative monthly payment                                                                          | No       | Yes (defaults) | `settings.mortgage_defaults`                            | S       | Client-side amortisation formula                                                                      |
| 60 | Branch / office pages                | `/branches/[slug]` (or single `/contact` if one branch)  | View team, properties, contact form                      | Branch detail page                                                                                 | Yes      | Yes    | `branches`, `agents`, `properties`                            | S       | One template, N branches                                                                              |

---

## C. Public pages and sitemap

Below: every public page with **purpose / main sections / CTAs / CMS-managed content / static content / forms / data saved / notifications**.

### C.1 `/` — Portal homepage

- **Purpose:** Direct the visitor into the right vertical with minimum friction.
- **Main sections:** Brand strap line; N vertical entry tiles (default 5: Sales, Lettings, New Homes, Commercial, Business Transfer; optional 6th: a niche / luxury sub-brand); footer with company registration line.
- **CTAs:** One "Enter" CTA per tile.
- **CMS-managed:** Tile titles, descriptions, background image/video per tile, ordering, visibility flag, optional sub-brand external link, strap line text.
- **Static:** Company registration line (`settings.company_registration_text`).
- **Forms:** None.
- **Data saved:** Click events (analytics only; no DB write).
- **Notifications triggered:** None.

### C.2 `/sales` — Buyers / Sales landing

- **Purpose:** Convert buyers; surface latest listings.
- **Sections:** Hero with strap line + search bar (video or image background); "Why us" three-pillar block; team intro + CTAs (Meet the Team, Contact); animated counter stats; embedded video introduction; instant valuation CTA strip; "Latest properties for sale" carousel (configurable count, query-driven); testimonials; optional sister-brand cross-promo; FAQs.
- **CTAs:** Search Properties; Meet the Team; Contact Us; Get Free Valuation; View All Properties.
- **CMS-managed:** Every text block, hero image/video, three pillars (icon + headline + body), stats numbers and labels, testimonials, FAQs, "latest properties" feed limit and filter.
- **Static:** Standard nav + footer.
- **Forms:** Hero search (redirect, no DB write); inline newsletter (if enabled).
- **Data saved:** `search_logs` row.
- **Notifications triggered:** None directly.

### C.3 `/sell-your-home` — Sellers / Valuation funnel

- **Purpose:** Capture seller leads via valuation request.
- **Sections:** Hero ("No sale, no fee" or equivalent positioning, plus curve-arrow visual pointing at CTA); marketing-pillar grid (professional photography, cinematic video, aerial / drone, branding, optimised listings, virtual tours, social marketing, dedicated support — 8 pillars typical); embedded valuation form (or link to multi-step `/valuation`); FAQs; testimonials.
- **CTAs:** Get a Free Property Valuation (sticky button + side-tab); Find Out More per pillar; tap-to-call.
- **CMS-managed:** All copy, pillar order/icon/headline/body, sticky CTA text, valuation form fields.
- **Forms:** Valuation Request Form (multi-step: address → property details → contact → consent).
- **Data saved:** `valuation_requests`, `enquiries (type=seller_valuation)`.
- **Notifications:** Email to valuations@ inbox; confirmation email to user; optional SMS to lead.

### C.4 `/tenants` — Tenants / Lettings landing

- **Purpose:** Help renters find a home; signpost the repair-reporting flow.
- **Sections:** Hero + search; "places to rent" copy block(s); latest rental listings; stats; **Report a Repair** banner with prominent CTA; FAQs (rights, credit checks, documents, guarantors, what PCM means, etc.).
- **CTAs:** Search Properties; Report Now (→ `/tenants/report-repair`); View All.
- **CMS-managed:** Copy, stats, FAQs, latest listings feed limit + filter.
- **Forms:** Hero search; optional tenant pre-qualification form (budget, move-in date, message).
- **Data saved:** Pre-qualification creates `enquiries (type=tenant)`.
- **Notifications:** Email to lettings@.

### C.5 `/landlords` — Landlord acquisition

- **Purpose:** Acquire landlord clients.
- **Sections:** Hero + Instant Rental Valuation CTA; partner / accreditation logos; services tier comparison (Fully Managed / Rent Collection / Let Only / Tenant Find); fee structure including rent-protection tiers and additional services; embedded enquiry form; testimonials; FAQs.
- **CTAs:** Get a free rental valuation; Enquire Now (per tier); Speak to lettings team.
- **CMS-managed:** Tier names, prices, included features, additional services, FAQs.
- **Forms:** Landlord Enquiry Form (name, email, phone, property address, current status [vacant / let / about-to-let], message).
- **Data saved:** `enquiries (type=landlord)`; optional `landlords` draft.
- **Notifications:** Email to lettings@; confirmation to user.

### C.6 `/new-homes` — New build / developer-pipeline page

- **Purpose:** New-build sales plus developer / investor pipeline.
- **Sections:** Hero; latest new-build listings (filtered by `is_new_home = true`); previous developments showcase (logo + name + town); stats (market share, developments managed, years experience); FAQs (stamp duty on new builds, survey advice, deposit timing, energy efficiency, what to ask on viewings); developer / investor enquiry CTA.
- **CTAs:** View All New Homes; Enquire Now.
- **CMS-managed:** Hero, developments collection (logo, name, town, description), all copy, FAQs.
- **Forms:** Developer Enquiry Form (separate fields: company name, role, land/build type, plot size, timescale, message).
- **Data saved:** `enquiries (type=developer)`; `developments` table for showcase.

### C.7 `/commercial` — Commercial sales & lettings

- **Purpose:** Commercial sales / lettings + agency representation.
- **Sections:** Hero; commercial property listings (`listing_type=commercial`); services; team; enquiry form; FAQs.
- **CTAs:** View Commercial Properties; Enquire Now.

### C.8 `/business-transfer` — Selling / buying businesses

- **Purpose:** Sell or acquire trading businesses (leasehold / freehold). This is distinct from commercial property.
- **Sections:** Hero; business listings (`listing_type=business`); "how it works" (valuation, marketing, qualifying buyers, completion); valuation enquiry form; FAQs.

### C.9 `/care-homes` — Specialist vertical

- **Purpose:** Help families find care homes / help operators sell care home businesses.
- **Sections:** Hero; explainer ("what is residential care"); lifestyle blocks; stats; FAQs; enquiry form.

### C.10 `/properties` — Unified property catalogue

- **Purpose:** Search and filter all properties.
- **Sections:** Filter bar (Buy / Rent toggle; Listing Type select; Cities / Location; Bedrooms; Bathrooms; Min/Max price; Order By); advanced filter modal (Added-to-site time window, "Include Sold STC / Let Agreed / Under Offer" toggle, "New Homes Only" toggle); active filter chips with clear-individual; results count; results grid; persistent "Sign Up Now" registration banner injected into the grid (e.g. position 3); pagination at the bottom; optional map view toggle.
- **CTAs:** Sign Up Now; Save This Search (logged-in); per-card "View Details".
- **CMS-managed:** Filter visibility, sort options, default `sale_type`, default `listing_type`, sign-up banner copy, results per page.
- **Forms:** Filter form (URL-driven); save-search form (logged-in).
- **Data saved:** `search_logs`; `saved_searches` if saved.
- **Notifications:** Saved-search alerts via cron.

### C.11 `/properties/[slug]` — Property detail

- **Purpose:** Convert interest into a viewing booking or enquiry.
- **Sections (in vertical order):**
  1. Status badge (For Sale / To Rent / Under Offer / Let Agreed / Sold STC / Sold / Let / New Home For Sale) — top-left, on hero image
  2. Title + town + postcode prefix (e.g. "Manchester Drive · Leigh-on-sea, SS9") + property type (e.g. "Detached bungalow") + sale-type pill ("For Sale")
  3. Price (with qualifier, e.g. "Offers In The Region Of £300,000" / "£1,100 PCM")
  4. Hero image with "View All" CTA and a "+N photos" thumbnail strip
  5. Facts strip with icons: property type, beds, baths, status, square footage
  6. Short description (1-2 sentence headline)
  7. Three key feature chips (e.g. "Swimming Pool", "Large Garden", "Garage")
  8. Action row: **Book a Viewing** / **Contact Agent** (tel:) / **Save Property**
  9. Long description with "Read More" toggle
  10. Map
  11. Train stations nearby
  12. Education (schools) nearby
  13. Booking sidebar / inline form (Name / Email / Phone / Date / Time slot dropdown with 3 bands: e.g. 9-12, 12-15, 15-19)
  14. Property Details table (ID, price, beds, baths, type, status)
  15. Floorplan
  16. EPC (or "Coming Soon")
  17. Virtual Tour
  18. Related Properties carousel (same area or same vertical)
  19. Sticky Sell-Your-Property / Free Valuation block
  20. Assigned agent card (photo + name + phone + email + inline message form)
  21. Free Valuation side block ("Thinking of selling?")
- **CTAs:** Book a Viewing; Contact Agent; Save Property; Send Message (agent); Request a Valuation; tel: link in sticky header on mobile.
- **CMS-managed:** Everything — see Section F for the full data model.
- **Forms:** Book a Viewing; Contact Agent (modal "Enquire about <property>", Name / Email / Phone / Address / Send Enquiry); Send Message to Agent (inline on agent card).
- **Notifications:** Email to assigned agent + branch email + valuations@ if seller-valuation form; ICS calendar attachment for viewings; confirmation to applicant.

### C.12 `/team` — Meet the team

- **Purpose:** Showcase staff; build trust.
- **Sections:** Filter chips (All / Directors / Business Support / Commercial / Lettings / Marketing / Negotiators / New Homes / Valuers / Sales Progressors — and a fun extra: "Office Pets" / "Furry Friends" for personality); grid of agent cards; profile modal or `/team/[slug]` route.
- **CMS-managed:** Agents (photo, name, role, department, bio, phone, email, social links), departments (label + slug + sort order), pets (treated as a special department).
- **Forms:** Optional "contact this team member" form on profile modal.

### C.13 `/locations` and `/locations/[slug]`

- **Purpose:** Area-guide content + local SEO landing pages per town.
- **URL note:** For SEO, also support keyword-friendly slugs like `/houses-for-sale-[town]` and `/flats-to-rent-[town]` via rewrites. The canonical source is `area_guides` but the route can be either.
- **Sections per guide:** Hero; about the area; transport, schools, amenities; current properties in the area (linked query); testimonials from that area; "thinking of selling here" CTA.
- **CMS-managed:** Area name, slug, intro, hero, sections (any page-section type), related properties query, SEO meta.

### C.14 `/news` and `/news/[slug]` — Knowledge hub / blog

- **Purpose:** SEO + thought leadership.
- **Sections (index):** Featured article; category filter; list; tag taxonomy; sidebar (popular, newsletter signup).
- **Sections (article):** Hero with title + author + date + reading time; body (MDX or block-based rich text); related articles; author card; share buttons; newsletter CTA.
- **CMS-managed:** Posts, categories, tags, authors.

### C.15 `/contact` — Contact / find the office

- **Purpose:** Make it easy to get in touch and find the office.
- **Sections:** Address; per-department phone numbers (Sales, Lettings, Commercial — with separate tel: links); per-department emails; business hours (with "appointments available outside these hours" note); embedded map; office photo; general contact form; social row.
- **CMS-managed:** Address, per-department phones, per-department emails, hours, map coords, office photo.
- **Forms:** General Contact Form (name, email, phone, department dropdown, message).
- **Data saved:** `enquiries (type=general)`.
- **Notifications:** Email routed by department.

### C.16 `/tenants/report-repair` — Repair reporting

- **Purpose:** Tenants submit maintenance issues.
- **Sections:** Intro + emergency notice (with phone number for true emergencies); multi-step form (Your details → Property → Issue & urgency → Photos / videos → Access permission → Review & submit); success page with ticket number.
- **CMS-managed:** Emergency notice copy, repair categories, urgency labels, success page copy.
- **Notifications:** Email to property manager + branch repairs queue; optional SMS for emergency tickets; confirmation to tenant with ticket number and "what happens next" timeline. Full spec in Section G.

### C.17 `/register` / `/login` / `/account` / `/account/saved` / `/account/searches` / `/account/viewings` / `/account/settings`

- **Purpose:** Customer account.
- **Forms:** Register (name, email, password, password confirmation, GDPR consent, optional marketing opt-in); Login (email + password); Forgot Password; Reset Password.
- **Notifications:** Email verification on register; password reset email; account-change confirmation.

### C.18 `/careers`

- **Purpose:** Recruitment.
- **Two implementations** depending on volume:
  - **Lean:** External link to an Indeed / Workable / Greenhouse feed (no DB).
  - **Full:** Internal job listings + application form (name, email, phone, role applied for, CV upload, cover letter, GDPR consent).
- **Notifications:** Email to HR with attachments.

### C.19a `/about` — About / Story page (optional)

- **Purpose:** Brand storytelling and trust-building. The reference site folds this into `/team` and the Sales-landing "Your Local Property Experts" block rather than having a stand-alone `/about`, but the brief asks for one — so spec it as an optional CMS page rendered through the page-builder.
- **Sections (typical):** Hero with founders' story, milestone timeline, values, awards / certifications, animated counter stats, team teaser linking to `/team`, sister-brand cross-promo, CTA strip.
- **CMS-managed:** Everything (uses the same page-builder section types as the other landing pages).
- **Forms:** None.

### C.19b `/branches/[slug]` — Per-branch / office pages

- **Purpose:** Local SEO surface + practical "find your nearest office" UX. Use when the agency has more than one branch; collapse to `/contact` when there's only one.
- **Sections:** Branch hero (logo + address + photos); embedded map; per-department phone numbers; opening hours; team members for that branch (filtered `<TeamGrid />`); latest properties from that branch; testimonials filtered to that branch; contact form pre-filled with that branch's department emails.
- **Schema.org:** `LocalBusiness` (or `RealEstateAgent`) per branch.
- **Forms:** Contact form (general).

### C.19 Legal pages

`/privacy`, `/complaints`, `/cookies`, `/terms` — all CMS-managed rich-text pages. Schema-driven so the same template renders any of them.

### C.20 System routes

`/sitemap.xml`, `/sitemap-properties.xml`, `/sitemap-news.xml`, `/sitemap-pages.xml`, `/robots.txt`, `/feed.xml` (news RSS), optionally `/portal-feed.xml` (Rightmove BLM v3 outbound feed if you syndicate to portals from this system).

---

## D. Backend configurable areas (CMS)

Every editorial element below must be editable from the admin dashboard without a developer. The unifying data structure is a **page-builder model**: a `pages` row owns an ordered list of `page_sections` rows; each section is *typed* and stores its content in a JSON `data` payload that matches a typed schema for that section type.

**Section types (the catalog the page-builder offers):**

`hero` · `hero_video` · `two_column` · `three_pillar` · `four_pillar` · `stats_row` · `testimonials` · `faq` · `property_carousel` · `property_grid` · `video` · `cta_strip` · `contact_info` · `gallery` · `rich_text` · `form_embed` · `pricing_tiers` · `team_grid` · `developments_grid` · `partner_logos` · `accordion`

**What's CMS-managed:**

- Portal homepage tiles, order, visibility, image/video, headline, link.
- Every vertical landing page (drag-drop section builder).
- Hero copy, video, image, strap line for each page.
- Brand pillars (icon + headline + body).
- Stats (number + label + small print).
- Testimonials (name, role, quote, photo, rating, location, sort order).
- FAQs (per-page taxonomy; question + answer; sort order; show/hide flag).
- Team members & departments (photo, bio, role, contact, social, sort order, department).
- Area / location guides (rich page-builder content).
- News posts (rich content, category, tags, author, featured image, scheduled publish).
- Legal pages (rich text + last-updated date).
- Menus: header navigation, mobile menu, footer columns. Each is a tree of menu items with `label`, `url`, `target`, `icon`, `sort_order`, `visibility` and `roles`.
- Footer columns, sub-headings, links, copy.
- Social media URLs (Instagram, Facebook, TikTok, YouTube, LinkedIn, WhatsApp, X, Threads).
- Sticky bar: phone number, WhatsApp number, review badge text + URL.
- Cookie banner copy, categories (necessary, analytics, marketing, preferences), per-category script tags.
- Email template content (subject, preheader, body — in a structured, version-controlled source format).
- SEO meta defaults (per-page override available).
- Settings (currency, locale, time zone, business hours, viewing-slot bands, default page size, results-per-page).

**Not CMS-managed (env-only):**

API keys, secrets, database URL, object-storage credentials. These live in environment variables and are surfaced read-only (with values masked) in the admin Integrations page.

---

## E. Static information areas

These items change so rarely that they can be code-defined or set once in `settings`. They are still editable by Super Admin via a "Site Settings" screen, but they are not editorial content:

- Company name & legal trading name.
- Company registration number and country of registration.
- Registered office address.
- ICO registration number.
- Property Ombudsman / Property Redress Scheme membership ID.
- Propertymark / ARLA / NAEA / RICS scheme IDs.
- Client Money Protection (CMP) scheme ID.
- VAT number (if applicable).
- Canonical domain.
- Default email "from" address and reply-to address.
- Default currency, locale and time zone.
- Default brand colour tokens (these can also live in CSS variables / theme config).

---

## F. Property listing data requirements

A single property entity, discriminated by listing type, is the spine of the catalogue. Where two address fields are described — internal address and public address — the public address is what the website renders to visitors and the internal address is what staff use to find or identify the property.

This section describes **what information the system must capture about each property**, organised by purpose. Implementation-level decisions (data types, indexes, table layout) are out of scope.

### Property — identification and lifecycle

The system shall capture for every property:

- A unique internal reference number (agency-defined format, e.g. AGY-S-00123) used by staff for quick lookup.
- An optional external identifier for properties imported from a portal feed or external CRM.
- A unique URL slug derived from the property title and location, used to construct the public web address.
- A title, typically the street name or building name.
- The listing type: residential, new home, commercial, business transfer, care home or land.
- The sale type: for sale or to rent.
- The publication status: draft, in review, published or archived.
- The market status: available, under offer, sold (subject to contract), sold, let agreed, let or withdrawn.
- A flag indicating whether the property is a new home (filters the "new homes only" search option).
- Flags for: featured listing; show on homepage; show price (when off, the public display reads "POA"); display order within listings.

### Property — pricing

The system shall capture:

- The asking price (numeric).
- A price qualifier: none, offers in excess of, offers over, offers in region of, guide price, fixed price, OIRO, POA, or "from".
- For rental properties: the rent frequency (per calendar month, per week, or per annum), deposit amount, holding deposit amount, minimum tenancy length in months, and let type (long let, short let, student, room, HMO).
- Availability date (for rentals or upcoming sales).

### Property — specification

The system shall capture:

- The category: house, flat, bungalow, studio, maisonette, commercial, land, room, retail, office, industrial, leisure, business, care home, HMO or mixed-use.
- The sub-category (e.g. detached, semi-detached, terraced, end-of-terrace, penthouse).
- Bedroom count, bathroom count and reception-room count.
- Internal size in square feet and square metres.
- Plot size in square feet and square metres (relevant for houses with significant outdoor space, and for land listings).
- Tenure: freehold, leasehold, share of freehold, commonhold, long leasehold, virtual freehold or unknown.
- For leasehold properties: years remaining on the lease, annual ground rent, annual service charge.
- Council tax band (A through H, exempt or unknown).
- EPC rating (A through G or "pending") and EPC numerical score (0 to 100).
- Furnished status: furnished, part furnished, unfurnished or optional.
- Parking description (free text — e.g. off-street, garage, permit, none).
- Outdoor-space description (e.g. private garden, balcony, patio).
- Chain status (e.g. no chain, chain free, upward chain).
- Heating description.
- Construction year.
- Listed status (e.g. Grade II, Grade I, none).

### Property — location

The system shall capture:

- The full internal address (two lines), used only by staff and never shown publicly.
- The public address line, typically a street name only, shown to visitors.
- The postcode (full) and the postcode prefix (first half — used for area-based search filtering).
- Town, city, county and country.
- A soft link to the area-guide entity for content-based linking.
- Geographic coordinates (latitude and longitude).
- A "hide exact address" flag — when on, the public map marker is offset and only the postcode prefix is rendered, for vendors who require discretion.

### Property — descriptions

The system shall capture:

- A short description (one or two sentences) used as a headline.
- A full description with rich-text formatting.
- A list of key features (typically three to ten short phrases such as "Swimming pool", "Large garden", "Garage").
- A list of room descriptions, each with a room name, written description, and dimensions in both imperial and metric units.
- A description of the local area.
- A list of nearby transport links, each with a name, distance (miles and kilometres) and type (railway station, bus stop, tube, motorway junction etc.).
- A list of nearby schools, each with a name, distance, type (primary, secondary, independent), Ofsted rating and an optional link.
- Additional notes (free text for anything that doesn't fit elsewhere).

### Property — media and documents

The system shall capture:

- A reference to the property's main image (used in cards, hero, and Open Graph previews).
- A URL to a video tour (e.g. YouTube, Vimeo or self-hosted).
- A URL to a 360° virtual tour (e.g. Matterport, Kuula or equivalent).
- A URL to a downloadable brochure (auto-generated from the property record or uploaded by staff).
- A URL to the Material Information document (Trading Standards / Property Ombudsman Material Information Parts A/B/C — a UK regulatory requirement).

The system shall additionally store any number of:

- **Property images:** image file URL, thumbnail URL, large-size URL, alt text, caption, display sort order, "is main" flag, "is floorplan" flag, image dimensions and file size.
- **Property documents:** document type (EPC, floorplan, brochure, material information, lease, planning, survey or other), file URL, file name, file size, MIME type, and a "is public" flag controlling whether the document is downloadable from the public site.

### Property — agent and branch assignment

The system shall capture:

- The assigned (primary) agent.
- An optional secondary agent.
- The branch the property belongs to.
- An optional phone-number override and email-address override that take precedence over the assigned agent's contact details when set.

### Property — SEO

The system shall capture:

- A meta title (used in browser tabs and search-engine result pages).
- A meta description.
- A reference to an Open Graph image (used for social-media link previews).
- An optional canonical URL override.
- A "no index" flag for properties that should not appear in search engines.

### Property — audit metadata

The system shall capture:

- The user who created the record and the user who last updated it.
- Creation, last-update and publication timestamps.
- A deletion timestamp (soft delete — the row is retained but hidden) so that an accidentally deleted property can be restored.

### F.1 Sales-specific information

Sales listings additionally surface or capture: the price qualifier, chain status, tenure (including lease years remaining, ground rent and service charge for leasehold), council tax band and EPC rating.

### F.2 Lettings-specific information

Lettings listings additionally capture: rent frequency, deposit amount, holding deposit, minimum tenancy length, let type, availability date, furnished status, plus the standard EPC rating, council tax band and parking information.

### F.3 New-home-specific information

New-home listings carry a flag identifying them as such, and are linked to a development entity that captures the development logo, name, town, description, expected completion date, number of units, photos, brochure and marketing pack. New-home listings can use a "from price" qualifier and an "off-plan" flag.

### F.4 Commercial-specific information

Commercial listings use the retail, office, industrial, leisure or mixed-use category. Floor area is the primary specification. Rent frequency may be per annum. Additional commercial-specific information includes: whether VAT is payable, annual business rates, and use class (e.g. E, B2, B8, Sui Generis).

### F.5 Business-transfer-specific information

Business-transfer listings (selling or buying a trading business rather than a property) additionally capture: annual turnover, gross profit, net profit, years trading, staff count, remaining lease years, current annual rent, and a "confidential" flag that hides the business's name and exact address from the public listing.

### F.6 Care-home-specific information

Care-home listings additionally capture: bed count, CQC rating, link to the CQC inspection page, list of services offered, and whether the home is being sold as a going concern.

---

## G. Repair system specification

This is the most behaviourally complex public form on the site. The reference site outsources this to a specialist maintenance product; we are specifying a first-party implementation that has the same shape and could later be swapped for a third-party service while keeping the same data model.

### G.1 Public user journey (tenant)

1. **Entry.** Tenant clicks "Report a Repair" from the `/tenants` page or footer; lands at `/tenants/report-repair`. An emergency notice at the top of the page lists what counts as an emergency (gas leak, total power loss, flooding, no heating in winter for vulnerable occupants, break-in, lift entrapment) with a direct phone number.
2. **Step 1 — Your details.** Name, email, phone (mobile preferred), tenant reference (optional), "are you the lead tenant?" yes/no.
3. **Step 2 — Your property.** Address line 1, line 2, town, postcode (autocomplete via postcoder/loqate optional); landlord name (optional); property reference if known.
4. **Step 3 — The issue.** Repair category (dropdown — see G.3); short title; long description (free text, min 30 chars, max 2,000 chars); when did the issue start (date picker).
5. **Step 4 — Photos & videos.** Multi-file upload (max 10 files; jpg/png/heic/mp4/mov; 25MB per file). Drag-and-drop or tap-to-pick on mobile. Direct upload to object storage with a pre-signed URL; the form itself stores only the URLs.
6. **Step 5 — Urgency & access.** Urgency level (Emergency / Urgent / Standard / Non-urgent — see G.4); access permission (radio — "Yes, you can enter with the key safe", "Yes, with appointment only", "No, contact me first"); preferred contact times; pets in property; vulnerable occupants flag.
7. **Step 6 — Review & submit.** Review summary; GDPR consent checkbox ("I consent to my data being processed for the purpose of resolving this repair request — see Privacy Policy"); a challenge-response anti-spam check; Submit button.
8. **Outcome.** Success page with ticket number (e.g. `RPR-2026-04321`), summary of next steps and SLA, and a "save this page" reminder. Confirmation email goes to the tenant. SMS goes to tenant if urgency=Emergency. Notification email goes to property manager and branch repairs queue; Slack/Teams webhook fires if configured.

### G.2 Admin workflow (staff)

- **Inbox view.** All tickets in a table — columns: ticket ID, tenant, property address, category, urgency badge, status, assignee, age, last update. Sortable, filterable (status, urgency, assignee, branch, date range). Quick-search by ticket ID or postcode.
- **Detail view.** Header with ticket meta; full description; photo / video gallery; status timeline; internal notes (rich text, with @mentions of staff); assign-to dropdowns (staff member + optional contractor); status changer; "mark as emergency"; "message tenant" (sends a templated email + appends to thread); attach internal documents (quotes, invoices); "request more info from tenant" (sends a templated email asking for clarification, sets status to `awaiting_tenant`).
- **Bulk actions.** Bulk assign, bulk status change, bulk export to CSV.
- **Contractor mode.** Optional contractor portal at `/contractor/[token]` where assigned external contractors can view ticket details (without internal notes), upload photos of completed work, and mark "work completed" (which puts the ticket into `awaiting_review`).

### G.3 Repair categories (configurable)

Stored in `repair_categories` table so admins can edit labels, icons and visibility. Default seed:

`plumbing` · `heating` · `electrical` · `appliance_issue` · `damp_or_mould` · `doors_or_locks` · `windows` · `roof_or_leak` · `pest_issue` · `garden_or_external` · `general_maintenance` · `emergency_repair` · `flooring` · `decoration` · `keys_lost` · `communal_areas` · `internet_or_phone` · `other`

Each category has: `slug`, `label`, `icon`, `default_urgency`, `auto_assign_role` (e.g. emergency → on-call manager), `sort_order`, `visible`.

### G.4 Urgency taxonomy

| Urgency       | Definition (in tenant-facing copy)                                                | SLA target (configurable) | Notification on submit                       |
|---------------|------------------------------------------------------------------------------------|----------------------------|-----------------------------------------------|
| Emergency     | Immediate risk to life, health or property (gas, flood, total power loss, break-in)| Contractor on site < 4 hours | Email + SMS + Slack to on-call manager       |
| Urgent        | Significant disruption (no hot water, blocked WC if only one in property, no heating in winter) | Contractor on site < 24 hours | Email + Slack to property manager       |
| Standard      | Affects use but not critical (broken appliance with workaround, minor leak)        | Acknowledged < 48 hours, resolved < 14 days | Email to property manager               |
| Non-urgent    | Cosmetic / minor (squeaky hinge, small mark on wall)                              | Acknowledged < 5 working days | Email to property manager (batched daily) |

### G.5 Status workflow

`new` → `triaged` → `contractor_assigned` → `work_in_progress` → `awaiting_review` → `completed`

Off-path states: `awaiting_tenant` (admin asked for more info), `on_hold` (e.g. waiting on parts), `rejected` (not our responsibility — admin must enter rejection reason).

Each transition writes a row to `repair_status_history` with `from_status`, `to_status`, `actor_user_id`, `notes`, `created_at`.

### G.6 Database fields

```sql
-- ============================================================
-- table: repair_requests
-- ============================================================
id                          uuid PK
reference                   varchar(32)  UNIQUE          -- e.g. "RPR-2026-04321"
tenant_name                 varchar(160)
tenant_email                varchar(160)
tenant_phone                varchar(40)
tenant_user_id              uuid FK -> users  NULL       -- if submitted while logged-in
tenant_ref                  varchar(80)                  -- tenant's own reference
is_lead_tenant              boolean
property_address_line_1     varchar(160)
property_address_line_2     varchar(160)
property_town               varchar(80)
property_postcode           varchar(16)
property_id                 uuid FK -> properties NULL   -- matched by admin
landlord_name               varchar(160)
landlord_id                 uuid FK -> landlords NULL    -- matched by admin
category_slug               varchar(64)                  -- FK soft link to repair_categories
issue_title                 varchar(160)
issue_description           text
issue_started_on            date
urgency                     enum [emergency, urgent, standard, non_urgent]
access_permission           enum [yes_keysafe, yes_appointment, no_contact_first]
preferred_contact_times     varchar(255)
pets_in_property            boolean
vulnerable_occupants        boolean
status                      enum [new, triaged, contractor_assigned, work_in_progress,
                                  awaiting_review, completed, awaiting_tenant, on_hold, rejected]
assigned_to_user_id         uuid FK -> users NULL
assigned_contractor_id      uuid FK -> contractors NULL
internal_notes              text                          -- legacy single-field fallback
branch_id                   uuid FK -> branches
sla_due_at                  timestamptz                   -- computed from urgency + category
gdpr_consent_at             timestamptz
ip_address                  inet
user_agent                  varchar(255)
created_at                  timestamptz default now()
updated_at                  timestamptz default now()
completed_at                timestamptz
rejected_reason             text
```

```sql
-- ============================================================
-- table: repair_files
-- ============================================================
id                  uuid PK
repair_request_id   uuid FK -> repair_requests
file_url            varchar(512)
file_name           varchar(255)
mime_type           varchar(80)
file_size_bytes     bigint
uploaded_by         enum [tenant, staff, contractor]
uploaded_by_user_id uuid NULL
created_at          timestamptz default now()
```

```sql
-- ============================================================
-- table: repair_status_history
-- ============================================================
id                  uuid PK
repair_request_id   uuid FK -> repair_requests
from_status         varchar(32)
to_status           varchar(32)
actor_user_id       uuid FK -> users
notes               text
created_at          timestamptz default now()
```

```sql
-- ============================================================
-- table: repair_messages  (threaded comms with tenant)
-- ============================================================
id                  uuid PK
repair_request_id   uuid FK -> repair_requests
direction           enum [staff_to_tenant, tenant_to_staff, staff_internal]
body                text
sent_by_user_id     uuid FK -> users NULL
email_message_id    varchar(255)                          -- for threading inbound replies
created_at          timestamptz default now()
```

```sql
-- ============================================================
-- table: repair_categories
-- ============================================================
slug                varchar(64) PK
label               varchar(80)
icon                varchar(64)
default_urgency     varchar(16)
auto_assign_role    varchar(32) NULL
sort_order          int
visible             boolean default true
```

```sql
-- ============================================================
-- table: contractors
-- ============================================================
id                  uuid PK
name                varchar(160)
trade               varchar(80)                           -- plumber, electrician…
email               varchar(160)
phone               varchar(40)
notes               text
is_active           boolean default true
created_at          timestamptz
```

### G.7 Email & notification triggers

| Event                                  | To                                                  | Template                          | Channel       |
|----------------------------------------|-----------------------------------------------------|-----------------------------------|---------------|
| Ticket submitted                       | Tenant                                              | `repair_confirmation`             | Email         |
| Ticket submitted (urgency=Emergency)   | Tenant                                              | `repair_emergency_ack`            | SMS + Email   |
| Ticket submitted                       | Property manager + branch repairs queue             | `repair_new_internal`             | Email         |
| Ticket submitted (urgency=Emergency)   | On-call manager                                     | `repair_emergency_internal`       | SMS + Slack   |
| Status → contractor_assigned           | Tenant                                              | `repair_contractor_assigned`      | Email         |
| Status → work_in_progress              | Tenant                                              | `repair_in_progress`              | Email         |
| Status → completed                     | Tenant                                              | `repair_completed_satisfaction`   | Email (with feedback link) |
| Tenant reply received                  | Assigned staff                                      | `repair_tenant_reply`             | Email         |
| Contractor uploads completion photos   | Assigned staff                                      | `repair_contractor_completed`     | Email         |
| SLA breach risk (75% of window elapsed)| Assigned staff + branch manager                     | `repair_sla_warning`              | Email + Slack |

---

## H. Admin dashboard specification

### H.1 Roles

| Role              | Scope                                                          | Key capabilities |
|-------------------|----------------------------------------------------------------|------------------|
| Super Admin       | Global                                                         | All CRUD on all data + user management + settings + integrations + audit log |
| Branch Manager    | Their branch(es)                                               | All branch-scoped CRUD on properties, leads, repairs; can manage branch agents; cannot manage other branches |
| Property Manager  | Their assigned properties                                       | CRUD on assigned properties; manage leads for their properties; manage repairs; cannot touch CMS |
| Sales Agent       | Sales lettings funnel                                          | Create / edit sales properties; manage own leads; book viewings; cannot publish (workflow gates) |
| Lettings Agent    | Lettings funnel                                                | Create / edit rental properties; manage own leads; book viewings; manage repair triage |
| Content Editor    | CMS only                                                       | Pages, sections, blog, area guides, team profiles, FAQs, testimonials, menus, footer, SEO |
| Repairs Manager   | Repairs only                                                   | Manage all repair tickets, contractors, repair categories; cannot touch properties |
| Read-only Auditor | Global, read-only                                              | View everything for compliance review; cannot edit |

Permissions are *not* hard-coded by role — they are stored in a `permissions` table and mapped to roles via `role_permissions`. New roles can be created by Super Admin from the UI.

### H.2 Admin sections

The admin dashboard is structured around a left sidebar (collapsible on mobile) with these top-level items:

1. **Dashboard overview** — KPI cards (active listings, new leads this week, viewings booked this week, overdue tickets, repairs by status), recent activity feed, alerts (SLA breach risk, properties expiring, contracts due to renew).
2. **Properties** — list / table view with filters; bulk actions (publish, unpublish, feature, archive); create / edit (multi-step form mirroring the data model in Section F); image manager with drag-drop reordering; document uploader; quick "duplicate" button; "preview as published" link.
3. **Enquiries (CRM)** — unified queue (see Section I).
4. **Viewings** — calendar view + list view; create / edit / cancel; reschedule with email re-confirmation; ICS export per viewing; conflict detection per agent.
5. **Valuations** — list of valuation requests; calendar of booked valuations; lead conversion buttons.
6. **Repairs** — full repair ticket inbox (see Section G).
7. **Contacts** — Landlords, Tenants, Buyers, Sellers — each a separate tab in a single Contacts area; one record can be linked to multiple roles over time.
8. **Team / Staff profiles** — agents, departments, sort order, contact details, social.
9. **Branches** — branch list; create / edit (name, address, phones, email, hours, lat/lng, logo).
10. **Testimonials** — quote, author, role, location, rating, sort order, source (Google/Trustpilot/manual).
11. **Knowledge hub / Blog** — posts, categories, tags, authors, scheduled publish.
12. **Area guides** — list + page-builder edit.
13. **Pages (CMS)** — homepage, vertical landing pages, legal pages — all editable via the page-builder.
14. **Menus** — header, mobile, footer.
15. **Footer** — columns, links, copy, certificates / membership badges.
16. **SEO** — per-page meta defaults, global defaults, redirect rules (301/302 list with old → new path), sitemap status, schema preview.
17. **Media library** — global file browser; folders; alt-text editor; bulk upload; usage counter (where each file is referenced).
18. **Email templates** — subject, preheader, body (rich text or MJML), per-template variable list, preview, send-test.
19. **Notification settings** — per-event recipients & channels (email/SMS/Slack/Teams).
20. **Integrations** — list of connected services (mapping, email, SMS, object storage, analytics, anti-spam, portal feeds); credential status (masked); test connection buttons.
21. **Users & roles** — list of staff; invite / suspend / reset password; assign roles; role editor (build a role from permissions).
22. **Settings** — company info, business hours, viewing time-slot bands, currency, locale, time zone, default page size.
23. **Audit log** — searchable feed of who-did-what-when.

### H.3 What staff can see / do (table)

| Section            | See                                            | Edit                                             | Actions                                                   | Data stored                  | Notifications sent                                       |
|--------------------|------------------------------------------------|--------------------------------------------------|------------------------------------------------------------|------------------------------|----------------------------------------------------------|
| Properties         | All properties in scope                        | All fields in Section F                          | Create, duplicate, publish/unpublish, archive, feature     | `properties`, `property_*`   | On publish: optional Slack notification; portal-feed push |
| Enquiries          | Lead queue                                     | Status, assignee, notes, follow-up date          | Reply, assign, archive, convert to contact                 | `enquiries`, `enquiry_notes` | Reply triggers email; reassignment notifies assignee     |
| Viewings           | Calendar + list                                | Date, time, agent, applicant                     | Confirm, reschedule, cancel                                | `viewing_requests`           | Confirm/reschedule/cancel each trigger applicant email + ICS |
| Valuations         | List + calendar                                | Date, time, valuer, status                       | Book, complete, no-show, convert to instruction            | `valuation_requests`         | Booking triggers user + valuer emails                    |
| Repairs            | Inbox                                          | Status, assignee, contractor, notes              | Assign, message tenant, attach files                       | `repair_*`                   | Per Section G.7                                          |
| Contacts           | Landlord/tenant/buyer/seller records           | Profile, notes, linked properties                | Merge duplicates, archive                                  | `landlords`, `tenants`, `vendors`, `buyers`, `contact_notes` | None automatic     |
| Team               | All agents                                     | Name, role, dept, photo, bio, contact, social    | Set sort order, hide                                       | `agents`                     | None                                                      |
| Branches           | All branches                                   | Address, phones, email, hours, lat/lng           | Activate / deactivate                                      | `branches`                   | None                                                      |
| Testimonials       | All                                            | All fields                                       | Reorder, hide, mark as verified                            | `testimonials`               | None                                                      |
| Blog               | All posts                                      | Title, body, category, tags, author, schedule    | Schedule publish, unpublish, duplicate                     | `blog_posts`, `blog_*`       | Optional newsletter on publish                            |
| Area guides        | All                                            | All page-builder content                         | Reorder, publish                                           | `area_guides`                | None                                                      |
| Pages (CMS)        | All editable pages                             | Section list (drag-drop), per-section data       | Save draft, publish, preview                               | `pages`, `page_sections`     | None                                                      |
| Menus              | All menus                                      | Items, hierarchy, visibility                     | Reorder                                                    | `menus`, `menu_items`        | None                                                      |
| SEO                | Per-page meta                                  | Title, description, OG image, canonical, noindex | Save, preview SERP card                                    | `seo_metadata`, `redirects`  | None                                                      |
| Media library      | All files                                      | Alt text, caption, folder                        | Upload, delete (only if unreferenced)                      | `media`                      | None                                                      |
| Email templates    | All templates                                  | Subject, preheader, body, variables              | Send test, preview                                         | `email_templates`            | None                                                      |
| Integrations       | Connection status (masked)                     | Provider choice, opt-in/out                      | Test connection                                            | `settings`                   | None                                                      |
| Users & roles      | All staff                                      | Profile, role assignment                         | Invite, suspend, password reset                            | `users`, `roles`             | Invite/reset emails                                      |
| Settings           | Site-wide                                      | All non-secret settings                          | Save                                                       | `settings`                   | None                                                      |
| Audit log          | Searchable history                             | Read-only                                        | Export                                                     | `audit_logs`                 | None                                                      |

---

### H.4 Dashboard overview screen

The first screen any staff user lands on after login. The composition adapts to their role: a Lettings Agent sees their own leads and viewings; a Branch Manager sees branch-wide totals; a Super Admin sees agency-wide.

**Top row — KPI cards (configurable per role):**

- *Active listings* — count, with delta vs last 7 days; click drills to `/admin/properties?status=published`.
- *New leads this week* — count, with delta and a mini sparkline by lead_type; click → CRM queue filtered.
- *Viewings booked this week* — count, plus a stacked breakdown of `pending / confirmed / attended / no_show`.
- *Valuations due* — count of `valuation_requests` with `visit_date` in the next 7 days.
- *Repair tickets* — count by urgency colour (Emergency / Urgent / Standard); SLA-breach-risk count in red if any.
- *Overdue follow-ups* — leads where `follow_up_date < today` and status not closed.
- *Pipeline value* — sum of `price` for properties where `market_status in (under_offer, sold_stc, let_agreed)` × commission rate.
- *Average response time* — median minutes from lead creation to first contact (last 30 days).

**Second row — Alerts panel:**

A scrollable list of alerts the user should act on, prioritised. Each alert has an icon, title, body, and one-click action button. Examples:

- "12 leads are unassigned" → button: "Assign now" (opens bulk-assign modal).
- "3 repair tickets are within 25% of SLA breach" → button: "Open queue".
- "Property *Manchester Drive SS9* has no EPC uploaded" → button: "Edit property".
- "Valuation booked for 14:00 tomorrow — no calendar invite sent" → button: "Send invite".
- "Tenancy ending in 14 days at *Clifton Avenue*" → button: "Open contact".
- "Saved-search alert digest failed to send (3 errors)" → button: "View logs".

Alerts are generated server-side by scheduled tasks (`hourly_alert_scan`, `daily_alert_scan`) and dismissable per-user.

**Third row — Activity feed:**

A live event stream filtered to the user's scope. Each entry shows actor avatar + verb + object + timestamp. Examples: "Sarah K. published *Rise Park, Basildon, SS15*", "James M. assigned lead #ENQ-2026-1142 to Olivia P.", "Tenant submitted repair #RPR-2026-04321 (Urgent — Plumbing)". Click any entry to jump to the record. Filterable by entity type (property / lead / repair / viewing / valuation / user).

**Right column — Calendar peek:**

A condensed seven-day strip showing the user's viewings, valuations and contractor visits. Hover a chip to see details; click to open the full calendar view.

**Personalisation:**

Every card can be hidden, reordered or resized via "Customise dashboard". Layout saves per-user. Branch Managers can additionally publish a "Branch default dashboard" that newly invited staff inherit.

### H.5 Property management — detailed control

The property record is the most field-heavy entity in the system, so the editor breaks across nine tabs surfaced as a left rail with progress dots.

**Tab 1 — Basics:**
Reference (auto-generated, editable by Super Admin only), title, slug (auto-derived from title + town + postcode_prefix; admin can override and the system records a 301 from the old slug), listing_type, sale_type, category, sub_category, status (draft / in_review / published / archived), market_status, featured toggle, show_on_homepage toggle, show_price toggle, display_order. A "Sync to portals" toggle decides whether this property is included in the outbound Rightmove/Zoopla/OnTheMarket feed.

**Tab 2 — Pricing:**
Price, price_qualifier dropdown, rent_frequency (only enabled when sale_type=rent), deposit, holding deposit, minimum tenancy, let_type, available_from, plus auto-computed fields shown read-only: "Price per sq ft" (price ÷ size_sqft), "Annual rent if PCM" (rent × 12), "Indicative agent fee" (price × commission_rate).

**Tab 3 — Specification:**
Bedrooms, bathrooms, reception rooms, size (sqft + auto-converted sqm), plot size, tenure, lease years remaining (only shown when tenure=leasehold), ground rent, service charge, council tax band, EPC rating + score, furnished, parking, outdoor space, chain status, heating, construction year, listed status. Key features as a tag-input (drag-reorderable, max 12).

**Tab 4 — Location:**
Internal address (line 1 + 2 — never published), public address line (what shows on site), postcode (with postcode-lookup autocomplete), town, city, county, country, area_slug (autocomplete from the area guides), latitude / longitude (autofilled from postcode but editable by dragging a pin on the embedded map), "Hide exact address" toggle (when on, the public marker is offset by a configurable radius and only postcode_prefix is rendered). Distance-from-station auto-calculation runs as a background job after save.

**Tab 5 — Descriptions:**
Short description (160 char counter), full description (rich-text editor with image, link, heading, list, table; AI "rewrite", "shorten", "lengthen", "tone: formal/friendly" buttons), room descriptions (repeater with name + size_imperial + size_metric + description per room), local area description, transport links (auto-suggested from the chosen map-search service, editable), schools (auto-suggested from the Ofsted dataset, editable), additional notes.

**Tab 6 — Media:**
The image manager occupies the whole tab. Drag-drop multi-upload with a progress bar; reorder by drag-drop; click any image to edit alt text, caption, set-as-main, set-as-floorplan, delete. AI alt-text suggestion fills empty fields. A separate section below holds documents: EPC, floorplan, brochure, material information (Part A/B/C — UK regulatory requirement from 2024), lease, planning. Each document has a type dropdown, a public/private toggle, and a thumbnail preview for PDFs.

A "Generate brochure" button at the top runs a server-side PDF render combining the photos, description, key features, agent card and EPC into a branded download — useful for agents who don't want to design their own.

**Tab 7 — Agent & branch:**
Assigned agent (autocomplete), secondary agent (optional), branch, phone override, email override (these blank-default to the agent's contact). When a property is reassigned, the previous and new agent both get an in-app + email notification with the property reference.

**Tab 8 — SEO:**
Meta title (with live SERP preview), meta description (with character counter), OG image picker, canonical URL override, `noindex` toggle, structured-data JSON-LD preview (read-only) showing what the property's `RealEstateListing` schema will emit. A "Generate with AI" button writes a first-draft meta title/description from the property data.

**Tab 9 — Publish:**
A pre-flight checklist with green/red ticks:
- [ ] At least 5 photos
- [ ] Main image set
- [ ] Floorplan uploaded
- [ ] EPC uploaded or marked "exempt"
- [ ] Material Information completed
- [ ] Full description ≥ 150 words
- [ ] At least 3 key features
- [ ] SEO meta title and description set
- [ ] Lat/lng confirmed
- [ ] Council tax band set
- [ ] Tenure confirmed

If everything's green the **Publish** button is enabled; if not, an "Override and publish anyway" requires a typed reason that goes into the audit log. After publishing, the screen shows a syndication panel: per-portal status (Rightmove ✓ 09:42, Zoopla ✓ 09:42, OnTheMarket ⏳ queued), a "Re-push to portals" button, and the canonical public URL with a copy button.

**Property list view (`/admin/properties`):**

- Default view: table with columns `Image · Reference · Title · Town · Type · Price · Status · Market Status · Agent · Branch · Updated`.
- Density toggle (compact / comfortable / spacious).
- Column-visibility menu (show/hide each column, drag to reorder).
- Server-side sort on any column.
- Filter chip bar above the table — quick filters for `Status`, `Sale Type`, `Listing Type`, `Branch`, `Agent`, `Created within`, `Market Status`, and a free-text search.
- Bulk-select via row checkbox; bulk-action bar appears when ≥1 selected: **Publish**, **Unpublish**, **Feature**, **Unfeature**, **Archive**, **Assign agent**, **Change branch**, **Export CSV**, **Push to portals**.
- "Saved views" — any combination of filters + columns + sort can be saved per-user with a name, and optionally shared to the branch or to the whole agency.
- Keyboard shortcuts: `/` focuses search, `N` opens new property, `J`/`K` navigates rows, `Enter` opens, `Shift+Enter` opens in new tab, `?` shows the shortcut sheet.

### H.6 Lead / CRM management — detailed control

The CRM queue at `/admin/enquiries` is the single most-used screen in the system. Its anatomy:

**Header row:**
- Tabs across the top: `All · Mine · Unassigned · Overdue follow-up · Closed`.
- Right-aligned: total count and **+ Add enquiry** (for staff who take a call and want to log it manually).

**Filter bar:**
- `Lead type`, `Status`, `Priority`, `Branch`, `Assigned to`, `Source page`, `Source campaign`, `Created within`, `Follow-up date`, `Has related property`, free-text search.
- Active filters render as removable chips below the bar.
- "Saved views" — same pattern as properties; pre-seeded views like *"My open buyer enquiries"*, *"Unassigned valuations last 24h"*, *"Tenant enquiries with no contact in 48h"*.

**Queue table:**
- Columns: `Status badge · Priority chip · Lead type · Name · Property · Source · Assigned · Age · Last activity · Follow-up date`.
- Age column colours green ≤ 4h, amber ≤ 24h, red > 24h for the response-time SLA.
- Click row opens a slide-over panel (without navigating away) for a quick triage; double-click opens the full detail page.

**Lead detail page:**
- **Header:** name, email + phone (with click-to-copy and click-to-call/SMS), badges for status + priority + lead_type, "Assign" button, status changer, "Mark as priority" toggle.
- **Activity timeline (left two-thirds):** chronological feed of every interaction — inbound submission, internal notes, outbound emails, outbound SMS, status changes, viewings booked, valuation booked. Each entry shows actor, channel, timestamp, and a preview of the body. Click to expand. Filter chips toggle activity types.
- **Compose box (bottom of timeline):** segmented control switches between *Note* (internal, no notification), *Email* (templated, threaded by `Message-ID` header), *SMS* (140-char counter; provider cost preview), *Call log* (writes a manual entry; auto-fills the start time and prompts for duration on save). A template picker offers the email-template library; selecting one merges variables (property title, agent name, branch phone) from the lead record.
- **Right rail:** property card if `related_property_id`, source attribution (UTM source / medium / campaign / content / term, first-touch + last-touch shown separately), GDPR consent timestamps, IP + UA, suggested actions ("Book a viewing", "Send a viewing slot", "Create a valuation request", "Convert to landlord contact").
- **Follow-up reminder:** date picker + optional time + optional note; saves to `enquiry.follow_up_date`; the system creates a calendar event and sends an in-app + email reminder at the chosen time.
- **Conversion:** the *Convert* dropdown turns the lead into a richer record — `Convert to Buyer profile`, `Convert to Tenant contact`, `Convert to Vendor`, `Convert to Landlord`. The lead stays linked to the new contact via `enquiry.converted_to_id`.

**Assignment rules editor (`/admin/settings/assignment-rules`):**

A no-code rule builder. Each rule is `IF <conditions> THEN <assignment>`. Examples:

- IF `lead_type = seller_valuation` AND `postcode_prefix in (SS9, SS0)` THEN assign to **Leigh branch valuer on duty**.
- IF `lead_type = repair_request` AND `urgency = emergency` THEN assign to **on-call manager** (rota stored in `settings.on_call_rota`) AND notify via SMS + Slack.
- IF `lead_type = buyer_enquiry` AND `related_property_id IS NOT NULL` THEN assign to **property's assigned_agent**.
- IF `lead_type = general_contact` AND `department = Sales` THEN round-robin within **Sales team**.

Rules are evaluated top-down; first match wins. A "Test rule" simulator lets you paste a sample lead JSON and see which rule fires.

**SLA configuration (`/admin/settings/sla`):**

Per lead_type and priority, set "first-contact target" and "resolution target" in minutes/hours. The dashboard, alerts and timeline badges all derive from this.

**Bulk actions on the queue:**

Bulk assign, bulk change status, bulk priority, bulk add note, bulk archive, bulk export. Bulk reply (with template) is available for newsletter-confirmation campaigns but not for active leads (to prevent template-spam on real prospects).

### H.7 Calendar & scheduling

`/admin/calendar` shows month / week / day / agenda views.

- **Event types** are colour-coded: viewings (blue), valuations (green), contractor visits (orange), internal blocks (grey), property launches (purple).
- **Filters:** by agent (multi-select), by branch, by event type. Per-user filter state is persisted.
- **Click a slot** to create an event (defaults to viewing). Smart inference: if you create a viewing, the form pre-fills property and applicant from the most-recent linked lead.
- **Click an event** to open in slide-over: confirm / reschedule / cancel / re-send invite / log outcome (attended / no_show / cancelled).
- **Conflict detection:** when assigning an agent, if the agent has a clashing event within the time-slot window, the form shows an inline warning with the conflict's title and a "Reassign to another agent" suggestion list.
- **Agent availability:** each agent has a weekly working-hours pattern (`settings.agent_availability`); outside-hours slots are visually struck through and require explicit override.
- **Two-way calendar sync:** optional Google Calendar and Microsoft 365 integration per-user. When on, the agent's external calendar is read for busy/free; events created in the admin push out to the external calendar with the property's address and a link back to the admin record.
- **Public booking link (optional):** each agent gets a Calendly-style URL `/book-viewing-with/[agent-slug]` showing only their free slots — useful for direct embed in an email signature.

### H.8 Repair workflows — admin perspective

(The tenant-facing journey is covered in Section G; this is the admin side.)

- **Repair inbox (`/admin/repairs`):** table with same filtering pattern as the lead queue, plus an urgency filter pinned to the top with red/amber/green pills showing the count in each bucket.
- **SLA badge** on every row: green ≤ 50% of window elapsed, amber 50–75%, red > 75%; black "breached" when 100% passed.
- **Triage screen** (the detail view): all the fields from G.6 plus an "Assign contractor" combobox pulling from the `contractors` table, a "Send to contractor" button that emails the contractor a magic-link to `/contractor/[token]` (no login required), and an internal message thread.
- **Bulk emergency dispatch:** if a building-wide issue affects multiple tickets, select them all and "Dispatch as batch" creates one contractor job covering all the property addresses.
- **Recurring maintenance scheduler:** for properties under full management, set up annual gas safety inspections, EICR checks, and PAT testing as recurring auto-generated tickets that appear in the inbox X days before the due date.

### H.9 Contacts management (Landlords / Tenants / Vendors / Buyers)

A single Contacts area with four tabs. Common patterns:

- **List view:** table with name, email, phone, role(s), associated property count, last activity, tags, source.
- **Tags:** free-form text tags (`VIP`, `Cash buyer`, `Investor`, `Difficult`, etc.) — filterable, searchable.
- **Duplicates panel:** the system flags possible duplicates (same email, same phone, fuzzy name match). One-click merge with a diff view of which field wins.
- **Contact detail:** header with name and contact details, tabs for *Overview · Properties · Communications · Notes · Documents · Compliance*. The *Properties* tab lists every property they own (landlords), rent (tenants), are selling (vendors) or have enquired about (buyers) — with status and dates.
- **Compliance tab (landlords/tenants):** stores Right-to-Rent check date and outcome, AML check date, identity documents (encrypted at rest), gas safety certificate, EICR, deposit-protection scheme reference + lodging date. Each item has an `expires_at` and surfaces in dashboard alerts when within 30 days of expiry.

### H.10 CMS — page builder and content control

`/admin/pages` shows the editable pages list. Page-level controls:

- **New page:** choose a layout template; the system pre-populates an empty section list.
- **Edit page:** the page-builder UI splits the screen 60/40 — left is a sortable list of sections, right is the live preview (with viewport toggle: desktop / tablet / mobile).
- **Drag-drop reorder:** sections rearrange with smooth animation; auto-save fires on drop.
- **Add section:** opens a modal listing every section type with thumbnail previews — *Hero · Hero Video · Two Column · Three Pillar · Four Pillar · Stats Row · Testimonials · FAQ · Property Carousel · Property Grid · Video · CTA Strip · Contact Info · Gallery · Rich Text · Form Embed · Pricing Tiers · Team Grid · Developments Grid · Partner Logos · Accordion*. Click to insert.
- **Per-section editor:** the right panel switches to a typed form for the section's data — e.g. a Three Pillar section shows three repeater rows each with icon + headline + body + optional link.
- **Visibility:** each section has visible-from / visible-until dates (for time-limited campaign blocks) and a per-role / per-audience visibility flag (e.g. "Logged-in customers only").
- **Draft / Publish workflow:** every save creates a draft; a "Preview" button opens a tokenised URL `/preview/[token]` rendering the draft state without affecting the live page. "Publish" commits.
- **Scheduled publish:** "Publish on [date/time]" queues a job for the future.
- **Versioning:** every publish creates a snapshot in `page_versions`; the "History" panel lists prior versions with author, timestamp and a diff view; one-click restore.
- **A/B testing (Nice-to-have):** two variants of any section can be defined with a traffic split; results in built-in analytics show conversion delta per variant.

### H.11 Theme and branding control

`/admin/settings/theme` is a no-code theme editor — the agency's marketing manager should be able to rebrand the whole site here without engineering.

- **Logo:** main, white (for dark backgrounds), favicon, OG default image, email header. Uploaded files appear in the media library tagged as theme assets.
- **Colours:** every design token from Section M (`brand-primary`, `brand-accent`, every `status-*` token) exposed as a colour-picker. A "Preview" panel shows a sample property card, hero and form re-rendering in real-time.
- **Typography:** font family picker for display + body (Google Fonts catalogue), size scale chooser (compact / default / spacious).
- **Spacing scale:** sm / md / lg (translates to a CSS-variable multiplier).
- **Component presets:** button radius, card radius, input radius — three options each.
- **Dark-mode toggle:** if enabled, a parallel set of tokens; the cookie banner gets a "dark mode" preference button.
- **Page-level overrides:** any vertical landing page can opt out of the global theme for a campaign-specific look.

Themes are stored in `settings.theme` as JSON; the live site reads it server-side and emits the values as CSS custom properties at the top of every page. Switching themes is therefore an O(1) operation — no rebuild required.

### H.12 Email & SMS template editor

`/admin/email-templates` (and `/admin/sms-templates`):

- **Templates list:** seeded with every transactional template the platform needs (viewing_confirmation, repair_emergency_ack, valuation_booked, saved_search_alert, password_reset, account_verification, etc.) plus user-created campaign templates.
- **Editor:** subject, preheader, body. Body editor offers two modes: *Rich text* and *email-source markup* (for marketers who want pixel-perfect control). A *Variables sidebar* lists every variable available for that template (`{{lead.name}}`, `{{property.title}}`, `{{property.url}}`, `{{agent.name}}`, `{{agent.phone}}`, etc.) — drag-drop into the body.
- **Conditional blocks:** Handlebars-style `{{#if lead.has_phone}}…{{/if}}` syntax for sections that should only render when a variable is set.
- **Send test:** pick a recipient email, select a sample record (real lead from the DB), preview rendered HTML, send test.
- **Live preview pane:** renders the template against the selected sample record, with desktop/mobile toggle and dark-mode toggle (Apple Mail / Gmail dark mode rules).
- **Localisation:** each template can have per-locale variants if multi-language is enabled.
- **Versioning:** same draft/publish/history pattern as pages.
- **Send-rate cap (per template):** safeguards against accidentally bulk-emailing 10k recipients — admin sets a daily cap; exceeding it requires Super Admin override.

SMS templates have the same shape minus rich formatting, plus a 160-char counter showing segments + projected cost (per the chosen SMS provider's price per segment to that country).

### H.13 Notification rules editor

`/admin/settings/notifications` — a matrix view:

- **Rows:** every notifiable event (`enquiry.created`, `viewing.confirmed`, `viewing.cancelled`, `repair.created`, `repair.emergency.created`, `repair.status_changed`, `property.published`, `property.under_offer`, `tenancy.ends.30d`, `gas_safety.expires.14d`, etc.) — about 60 events seeded.
- **Columns:** channels — Email, SMS, In-app, Slack, Teams, Webhook.
- **Cell:** click to configure for that event × channel: recipients (specific addresses, roles, teams, branch managers, the assigned agent, the lead's agent, etc.), template, throttle (e.g. "max 1 per hour per recipient"), conditions ("only if `urgency=emergency`").

A "Test notification" button fires a real notification using a sample record. The notification log (`/admin/notifications/log`) shows delivery status (queued / sent / failed / bounced / delivered / opened / clicked).

### H.14 No-code form builder

`/admin/forms` lets a non-developer add new forms to any page without engineering.

- **Form list:** every form on the site (seeded with the canonical ones from N.7, plus any custom forms).
- **New form:** name, intent (`lead_type` mapping), success behaviour (inline message, redirect URL, show another form, trigger download).
- **Field builder:** drag-drop from a palette — `Text`, `Email`, `Phone`, `Number`, `Select`, `Multi-select`, `Radio`, `Checkbox`, `Textarea`, `Date`, `Time`, `Date+time`, `File upload`, `Address autocomplete`, `Postcode lookup`, `Hidden`, `Section break`, `Conditional group`. Each field has label, placeholder, help text, required toggle, validation regex, default value.
- **Conditional logic:** "Show field X only if field Y = value Z".
- **Notification mapping:** which notification rules fire on submit; which template; which recipient.
- **Embed:** the form gets a slug; embed by referencing `<FormEmbed slug="..."/>` in any page-builder rich-text section.
- **Submissions table:** each form has a submissions log filterable like the CRM queue.

### H.15 Workflow automation builder

`/admin/automations` — a trigger → condition → action canvas (think Zapier inside the admin).

- **Triggers:** any of the 60 system events (lead created, viewing confirmed, property published, repair status changed, contract anniversary, contact created with tag X, etc.) plus scheduled triggers ("every Monday 09:00", "on the 1st of every month").
- **Conditions:** any combination of field comparisons against the triggering record.
- **Actions:** send email (with template), send SMS, send in-app notification, assign to a user, change status, add tag, create a follow-up reminder, post to Slack, call webhook, create a calendar event, generate a document.
- **Multi-step flows:** chain actions with delays ("wait 3 days, then check if status is still X, then send template Y").
- **Pre-built recipes:** seed templates such as *Tenant onboarding sequence*, *Viewing follow-up*, *Valuation 7-day nudge*, *New listing announcement*, *Anniversary touch-base*.
- **Run log:** every automation execution writes a log row with trigger payload, condition outcomes, actions taken, errors.

### H.16 Integrations admin

`/admin/integrations` — a tile grid of every supported integration grouped by capability: mapping, transactional email, SMS, anti-spam, analytics, error monitoring, property portals (Rightmove, Zoopla, OnTheMarket and equivalents), Land Registry, postcode lookup, maintenance / repairs, tenant referencing / AML, rent collection, business registry, payments, newsletter / audience, team messaging (Slack, Teams and equivalents).

Each tile:

- **Status pill:** Connected / Not connected / Error.
- **Per-integration config screen:** required env keys (masked, shown as `••••1234` with a "rotate" button), feature toggles (e.g. for Rightmove: which property statuses to include, branch ID, FTP credentials, schedule), webhook URLs (for inbound), sync history table.
- **Test connection** button — fires a real lightweight call and reports success/failure.
- **Last sync** timestamp + outcome; "Run sync now" button.
- **Logs viewer:** scoped to that integration, with search by date range and outcome filter.
- **Cost surface** (where available): a "Usage this month" panel pulling from the provider's billing API (SMS cost, map tile requests, email volume).

Secrets are stored in a secret-manager (not in Postgres); the admin UI only displays masked values and rotates via the manager.

### H.17 Users, roles & permissions

`/admin/users` and `/admin/roles`:

- **Users list:** name, email, role(s), branches, status (active / suspended / pending invite), last login, 2FA status.
- **Invite user:** email, role, branch scope; the invitee receives a one-time link to set their password and 2FA.
- **Per-user impersonation** (Super Admin only): "Login as this user" creates a flagged session — every action taken while impersonating is tagged in the audit log with both actor IDs.
- **Bulk user import:** CSV with email, name, role, branch.
- **Suspension / deletion:** suspended users keep their data; deleted users have personal fields anonymised but their actions remain in the audit log for compliance.

**Role builder (`/admin/roles`):**

- Predefined roles from H.1, plus "+ Create role".
- The role editor shows a permissions matrix grouped by domain — *Properties · CRM · Repairs · Calendar · Contacts · CMS · Team · Branches · Testimonials · Blog · Area Guides · Menus · SEO · Media · Email Templates · Settings · Integrations · Users & Roles · Audit Log · Reports*. Each row has columns: *View, Create, Update, Delete, Publish, Assign, Export, Bulk-action*.
- A "Branch-scope" toggle on the role: when on, every query for users in that role gets a `WHERE branch_id IN (user_branch_ids)` filter at the data layer.
- "Test as role" simulates the admin UI for the role — shows which screens disappear, which buttons grey out.

### H.18 Branches and departments

`/admin/branches`:

- Branch CRUD with name, slug, address, lat/lng, opening hours, per-department phones and emails, logo, hero image, sort order, is_active.
- **Custom domain support:** if running a multi-brand setup, each branch can have its own public hostname mapping to a branch-scoped front-end skin.
- **Branch-level overrides** of theme tokens, email templates, footer content, business hours.
- **Department list per branch:** Sales, Lettings, Commercial, Property Management — each with its own inbox routing.

### H.19 Settings hierarchy

`/admin/settings` — a tabbed interface organised by domain. Critically, every setting has a clear *scope*:

- **Org-level:** the default value across the entire agency.
- **Branch-level overrides:** a branch can override any org-level setting; the badge "Overridden by Leigh branch" appears on the org setting.
- **User-level overrides:** a user can override certain settings (notification preferences, calendar sync, dashboard layout).

The setting screen shows the **effective value** for the current user/branch context and the inheritance chain. Examples of setting groups:

- **Company:** name, legal name, registration number, ICO number, redress-scheme memberships, VAT, registered address.
- **Localisation:** currency, locale, time zone, date format, distance unit (miles/km).
- **Business hours:** weekly schedule with bank-holiday exclusions.
- **Viewing slots:** default time bands (e.g. 9-12 / 12-15 / 15-19) — configurable per branch.
- **Commission rates:** sales %, lettings %, used for pipeline projections.
- **Property defaults:** default `show_price = true`, default `featured = false`, default new-property branch.
- **Lead defaults:** default `priority = normal`, default `follow_up_days = 2`.
- **Repair SLA bands:** see Section G.4.
- **GDPR:** retention periods (enquiries / search logs / consent logs / audit logs), default consent text, default privacy-policy URL.
- **Search:** default page size, default sort, filter visibility flags.
- **Maps:** provider selection, style URL, default zoom.
- **Feature flags:** an in-built feature-flag list (mortgage_calculator, stamp_duty_calculator, saved_searches, customer_accounts, live_chat, etc.) with on/off, beta-only, percentage rollout.
- **Maintenance mode:** site-wide toggle that returns a holding page to public visitors while keeping the admin accessible.
- **API tokens:** issue/revoke long-lived tokens for partner integrations (each token has a scope and expiry).
- **Webhooks:** outbound webhook recipients + signing secrets (see K.4).

### H.20 Audit log and compliance

`/admin/audit`:

- **Filters:** actor (user picker), action (multi-select from a known list), entity, entity_id, date range, IP, branch.
- **Row detail:** click any row to see the full diff (`before` vs `after` JSON), the request metadata (IP, UA, route), and the actor.
- **Compliance shortcuts:** *"Find everything a user has done in the last 30 days"*, *"Find every change to property X"*, *"Find every deletion in the last 7 days"*.
- **Export:** CSV or JSON of the filtered view; the export itself is audit-logged.
- **GDPR Subject Access Request tool:** enter an email, the system runs an aggregated query across `users`, `enquiries`, `viewing_requests`, `valuation_requests`, `repair_requests`, `landlords`, `tenants`, `vendors`, `buyers`, `saved_searches`, `saved_properties`, `subscribers`, `notification_log`, `consent_logs`, `audit_logs` and produces a single zipped JSON + attached files. Logs the export.
- **GDPR Erasure tool:** enter an email, preview every row that would be affected, type a confirmation, run; the system anonymises personal fields (name → `[erased]`, email → `[erased@example.invalid]`, phone → `[erased]`, file URLs unlinked, files deleted from storage). The action itself is audit-logged with the actor.

### H.21 Reports and analytics

`/admin/reports` — both pre-built reports and a custom report builder.

**Pre-built reports (every report can be filtered by date range, branch, agent, source, and exported to CSV / Excel / PDF):**

- *Leads by source* (page + UTM funnel).
- *Leads by lead_type over time* (stacked area chart).
- *Lead conversion rate* (new → contacted → converted), per source / agent / branch.
- *Average time to first contact*.
- *Time on market* (created → first market_status change).
- *Asking-vs-achieved price ratio* (per agent / per branch).
- *Pipeline by stage and value*.
- *Repair tickets by category, urgency, SLA*.
- *Viewings by outcome*.
- *Valuations: booked / completed / instructed conversion*.
- *Top-performing properties* (views, enquiries, time to under-offer).
- *Saved-search alert performance* (delivery rate, click-through).
- *Email campaign performance* (open, click, bounce, unsubscribe).
- *Cost per lead* (paid-channel spend ÷ leads).
- *Agent league table* (configurable score = listings + sales + commissions).
- *Compliance status* (gas safety, EICR, EPC, deposit-protection coverage).

**Custom report builder:**

A pivot-style UI: pick a data source (Properties / Leads / Viewings / Repairs / etc.), pick dimensions (group-by fields), pick measures (count, sum, average), pick filters, pick visualisation (table / bar / line / pie / KPI tile). Save as a named report; pin to the dashboard; share with the team.

**Scheduled report email:** any report can be emailed (CSV attached) on a cron — e.g. *"Email me the unassigned leads report every Monday at 9am"*.

### H.22 Data exports, imports, backups

- **Exports:** any list view supports CSV export of the filtered set. Larger exports (>10k rows) run as a background job and email a download link when ready.
- **Imports:** `/admin/imports` supports CSV / XML uploads for properties, contacts, testimonials. The importer parses, validates, shows a preview with errors flagged per row, and lets the admin choose dry-run, create-only, or upsert (matching on `external_id` or `reference`). Import results are stored in `import_logs`.
- **Backups:** admin can trigger a manual on-demand database snapshot (Super Admin only), see scheduled backup history, and request a download URL (the URL is short-lived and audit-logged).
- **Object-storage browser:** Super Admin gets a paginated browser of the media bucket with restore-from-versioning controls — useful when a file is accidentally deleted.

### H.23 Scheduled tasks (cron)

`/admin/scheduled-tasks`:

- A table of every scheduled job — name, cron expression, last run timestamp, last run outcome, average runtime, next run.
- Built-in jobs: `saved_search_alerts` (daily 07:00), `weekly_digest_email` (Mon 08:00), `sitemap_regenerate` (every 6h), `portal_feed_push` (every 30 min), `expired_property_archive` (daily 02:00), `compliance_alert_scan` (daily 01:00), `notification_log_purge` (weekly), `search_log_purge` (weekly), `audit_log_cold_storage` (monthly), `backup_db` (daily 03:00).
- Per-job: "Run now", "Pause", view recent logs.
- "+ New custom job" lets admins schedule a custom report email or a custom workflow trigger.

### H.24 Maintenance mode and feature flags

- **Maintenance mode toggle:** Super Admin only. When on, the public site returns a configurable holding page (CMS-edited) with a tel: and email link; admin remains accessible. Staff IPs / authenticated sessions bypass the holding page.
- **Feature flags:** see H.19.
- **Beta tester pool:** a list of staff or customers who see flags marked `beta`. Useful for soft-launching the customer-account area to a small group.

### H.25 Search admin

- **Saved searches viewer (Super Admin):** see every saved search across the user base — useful for spotting demand patterns ("47 users have saved a search for 3-bed houses in SS9 under £600k").
- **Popular searches dashboard:** top 50 location + filter combinations by volume; informs which area guides to write next and which postcodes to focus property acquisition on.
- **Failed-search log:** searches that returned zero results — informs inventory gaps.
- **Search synonyms editor:** map `flat` ↔ `apartment`, `home` ↔ `house`, common misspellings of town names.

### H.26 Mobile admin considerations

- The admin is responsive, but for in-field staff a **PWA install** is offered with offline-capable read of properties and contacts. Submissions queue when offline and sync when reconnected.
- Critical actions reachable from the home-screen icon: *Add lead from call*, *Quick add property* (minimal-field draft), *Today's viewings*, *Open ticket inbox*.
- Push notifications via web push (PWA) and via the optional native wrapper for Rex-Pocket-style functionality if budget allows.

### H.27 Admin keyboard shortcuts (global)

| Shortcut | Action |
|---|---|
| `/` | Focus global search |
| `?` | Open shortcut cheatsheet |
| `G` then `P` | Go to Properties |
| `G` then `L` | Go to Leads |
| `G` then `R` | Go to Repairs |
| `G` then `C` | Go to Calendar |
| `G` then `D` | Go to Dashboard |
| `G` then `S` | Go to Settings |
| `N` | New (context-aware — new property if on Properties list, new lead on Leads list, etc.) |
| `J` / `K` | Next / previous row |
| `Enter` | Open selected row |
| `Shift+Enter` | Open in new tab |
| `E` | Edit selected row |
| `A` | Assign (in CRM / repairs) |
| `S` | Save (in any edit screen) |
| `Cmd/Ctrl+K` | Command palette (jump-to-anywhere) |
| `Esc` | Close modal / slide-over |

### H.28 Global search / command palette

`Cmd/Ctrl+K` opens an Algolia-style command palette searching across:

- Properties (by reference, title, postcode, street)
- Leads (by name, email, phone, reference)
- Contacts (landlords, tenants, vendors, buyers)
- Pages and blog posts (by title)
- Settings (by name — type "SLA" and jump straight to `/admin/settings/sla`)
- Help articles (links to internal documentation)
- Actions (type "new property" to trigger the action)

Each result shows entity type, key fields, and a keyboard shortcut to open.

---

## I. CRM and lead workflow

### I.1 Lead taxonomy

A single `enquiries` table with a `lead_type` discriminator. Every public form on the site writes to this table.

| `lead_type`          | Public source                                         |
|----------------------|-------------------------------------------------------|
| `buyer_enquiry`      | Property detail "Contact Agent"                       |
| `viewing_request`    | Property detail "Book a Viewing"                      |
| `seller_valuation`   | `/sell-your-home` valuation form                      |
| `landlord_enquiry`   | `/landlords` form                                     |
| `tenant_enquiry`     | `/tenants` form                                       |
| `repair_request`     | `/tenants/report-repair` (also rows in `repair_requests`) |
| `general_contact`    | `/contact` general form                               |
| `career_enquiry`     | `/careers` application                                |
| `developer_enquiry`  | `/new-homes` developer/investor form                  |
| `commercial_enquiry` | `/commercial` form                                    |
| `business_enquiry`   | `/business-transfer` form                             |
| `newsletter_signup`  | Footer newsletter                                     |

### I.2 Enquiry record fields

Each enquiry stores:

- `name`, `email`, `phone`
- `lead_type` (enum, see above)
- `message` (free text)
- `related_property_id` (nullable FK)
- `source_page` (URL the form was submitted from)
- `source_campaign` (UTM source/medium/campaign/content/term — first-touch and last-touch)
- `assigned_user_id` (nullable FK)
- `status` (see I.3)
- `priority` (low / normal / high / urgent)
- `notes` (1:N via `enquiry_notes` for threaded notes with author + timestamp)
- `follow_up_date` (nullable date)
- `gdpr_consent_at` (timestamptz)
- `marketing_opt_in` (boolean)
- `ip_address`, `user_agent`
- `created_at`, `updated_at`, `closed_at`

### I.3 Lead statuses

`new` → `contacted` → (`viewing_booked` | `valuation_booked` | `waiting_for_response`) → (`converted` | `lost`) → `archived`

- `new`: just submitted, no one has touched it.
- `contacted`: a staff member has reached out (logged manually or auto-set when an email reply is sent through the system).
- `viewing_booked`: a viewing has been scheduled (sets a link to `viewing_requests.id`).
- `valuation_booked`: a valuation has been scheduled.
- `waiting_for_response`: waiting on the applicant to come back; the system can auto-nudge after N days.
- `converted`: deal closed (sale agreed / let agreed / valuation taken to instruction).
- `lost`: cold or explicitly declined (capture a reason: price, location, fell-through, no-response, other).
- `archived`: closed-out, kept for reporting.

### I.4 Assignment rules (configurable)

Round-robin by branch, by listing type, or by department. Examples:

- `buyer_enquiry` with `related_property_id` set → assign to property's `assigned_agent`.
- `seller_valuation` with postcode in `SS9*` → assign to Leigh branch valuer on rota.
- `repair_request` with `urgency=Emergency` → on-call manager (set in `settings.on_call_rota`).
- `general_contact` with department=`Sales` → Sales team round-robin.
- Fallback: branch manager.

### I.5 Reporting

The CRM ships with these built-in reports (filterable by date range, branch, agent, source):

- Leads by source (page + UTM) — funnel chart.
- Leads by `lead_type` over time — stacked bar.
- Conversion rate by source — leads → contacted → converted.
- Average time to first contact (per agent / per branch).
- Outstanding follow-ups (overdue follow_up_date).
- Repair tickets by urgency and SLA status.
- Property days-on-market (created → market_status changed away from `available`).

---

## J. Data requirements (entities and attributes)

This section describes every entity the system must capture, the attributes each entity carries, and the relationships between entities. It is implementation-neutral: it does not specify a database product, types, indexes or storage layout. Each entity below maps to one logical record set; an implementation may choose to combine or split them according to its chosen technology.

### J.1 Identity and access entities

**User**
Every person who can sign in (staff or customer). The system shall capture: email address (unique), email verification timestamp, a secure password digest, name, phone, user type (staff or customer), active flag, last-login timestamp, two-factor-authentication enabled flag, two-factor secret, marketing-opt-in flag, creation and last-update timestamps, and a soft-deletion timestamp.

**Role**
A named bundle of permissions. The system shall capture: a slug (machine name), label, description, and an "is system" flag distinguishing built-in roles from custom ones.

**Permission**
A discrete capability such as "publish a property" or "delete a lead". The system shall capture: slug, label, and a group label for grouping in the UI (Properties, CRM, CMS, etc.).

**Role-permission assignment**
The many-to-many relationship between roles and permissions.

**User-role assignment**
The many-to-many relationship between users and roles, optionally scoped to a branch. The branch scoping is what makes a Branch Manager's role apply only to their own branch.

**Session**
An active sign-in. The system shall capture: a reference to the user, a one-way hash of the session token, the client IP and user-agent, an expiry timestamp, and a creation timestamp.

### J.2 Branches and agents

**Branch**
A physical office. The system shall capture: slug, name, address (multi-line), town, postcode, county, country, separate phone numbers per department (sales, lettings, commercial), separate emails per department, opening hours per day of the week, geographic coordinates, logo, hero image, active flag, sort order and creation timestamp.

**Agent**
A staff member shown on the public Team page. The system shall capture: slug, an optional link to a User record (only set if the agent also signs in), name, role title, department, biography, email, phone, optional WhatsApp number, photo, a structured list of social-media links, branch, active flag, sort order, and a flag controlling whether the agent appears on the public team page.

**Agent department**
A grouping for the team-page filter chips. The system shall capture: slug, label, sort order and visibility flag.

### J.3 Property catalogue

The property entity and its attributes are defined in full in Section F. In addition:

**Property image**
An image attached to a property. The system shall capture: a reference to the property, the original file URL, thumbnail and large-size variants, alt text, caption, sort order, "is main" flag, "is floorplan" flag, image dimensions, file size and creation timestamp.

**Property document**
A document attached to a property (EPC, floorplan, brochure, Material Information document, lease, planning permission, survey, or other). The system shall capture: a reference to the property, document type, file URL, file name, file size, MIME type and a "is public" flag controlling whether the document is downloadable from the public site.

**Saved property**
A property a registered customer has saved to their account. The system shall capture: the user, the property, and the timestamp of saving. The combination of user and property must be unique.

**Saved search**
A set of search filters a registered customer has saved. The system shall capture: a reference to the user, a name the user gave the search, the structured filter criteria, an alert frequency (off, instant, daily or weekly), the timestamp of the most recent alert sent, and a creation timestamp.

**Search log**
A record of every public search performed. The system shall capture (where available): the user, an anonymous session identifier, the structured filter criteria, the number of results returned, the client IP and the timestamp. Used for popular-search reporting and zero-result analysis.

**Development**
A new-home development containing multiple individual property listings. The system shall capture: slug, name, description, logo, hero image, town, postcode prefix, total unit count, available unit count, expected completion date, "is current" flag, brochure URL, sort order and creation timestamp.

### J.4 Leads and CRM

**Enquiry**
The unifying record for every inbound lead, regardless of source. The system shall capture: a reference identifier (human-readable, e.g. ENQ-2026-0123), the lead type (buyer enquiry, viewing request, seller valuation, landlord enquiry, tenant enquiry, repair request, general contact, career enquiry, developer enquiry, commercial enquiry, business enquiry, newsletter signup), contact name, contact email, contact phone, the message body, an optional reference to a related property, the source page URL, structured source-campaign attribution (UTM source, medium, campaign, content, term — both first-touch and last-touch), assigned user, branch, status (new, contacted, viewing booked, valuation booked, waiting for response, converted, lost, archived), priority (low, normal, high, urgent), follow-up date, GDPR consent timestamp, marketing-opt-in flag, client IP and user-agent, closure timestamp, closure reason, and standard creation/update timestamps.

**Enquiry note**
A threaded note attached to an enquiry. The system shall capture: a reference to the enquiry, the author, body text, an "is internal" flag (controls whether the note can be shown in any client-facing communication), and a creation timestamp.

**Viewing request**
A request to view a property. The system shall capture: a reference identifier, an optional link to the originating enquiry, the property, applicant name, applicant email, applicant phone, preferred date, preferred time slot, confirmation timestamp, assigned agent, status (pending, confirmed, rescheduled, cancelled, attended, no-show), notes and creation timestamp.

**Valuation request**
A request for a property appraisal. The system shall capture: reference identifier, optional link to the originating enquiry, applicant contact details, property address (line 1, line 2, town, postcode), property type, bedroom count, intent (sell, let, both, just curious), timescale (ASAP, three months, six months, twelve months, no timescale), whether the owner has a mortgage, the owner's estimated value, an optional indicative valuation range produced by the system (low and high), assigned valuer, scheduled visit date and time slot, status (new, booked, completed, declined, instructed), notes and standard timestamps.

### J.5 Contacts

The system shall capture distinct records for **Landlords, Tenants, Vendors (sellers) and Buyers**, since the same person can occupy several roles over time and each role carries different attributes. An implementation may store these as four separate entities or as one unified contact entity with a roles list; the requirements below describe the attributes regardless of structure.

**Landlord**
Name, email, phone, preferred contact channel (email, phone, SMS, WhatsApp), full address, bank-account details (encrypted at rest for rent disbursement), notes, source identifier (how the contact was acquired), and standard timestamps.

**Tenant**
Name, email, phone, date of birth, guarantor name and phone, current address, employment information (employer, role, gross annual income), an optional link to the property currently rented, notes and creation timestamp.

**Vendor (seller)**
Name, email, phone, optional link to the property being sold, notes and creation timestamp.

**Buyer**
Name, email, phone, budget minimum and maximum, position (first-time buyer, chain-free, in chain, cash buyer, buy-to-let investor), search areas, minimum bedrooms, preferred property types, funds-verified flag, notes and creation timestamp.

### J.6 Repairs

The repair-request and supporting entities are defined in full in Section G. In summary, the system shall capture:

- **Repair request** — the ticket itself (tenant details, property address, category, description, urgency, status, assigned staff, assigned contractor, SLA target time, GDPR consent, and lifecycle timestamps).
- **Repair file** — attachments to a ticket (file URL, MIME type, size, whether uploaded by tenant, staff or contractor).
- **Repair status history** — an immutable log of every status transition with actor and notes.
- **Repair message** — threaded communication between staff, tenant and contractor.
- **Repair category** — the configurable taxonomy (plumbing, heating, electrical etc.) with default urgency and routing.
- **Contractor** — external trades the agency dispatches work to (name, trade, email, phone, notes, active flag).

### J.7 Content management

**Page**
A managed page on the public site. The system shall capture: slug, title, layout template name, status (draft or published), publication timestamp, creation and last-update timestamps, and the user who last updated.

**Page section**
A typed block within a page. The system shall capture: a reference to the page, the section type (hero, three-pillar, stats, testimonials, FAQ, property carousel, video, rich text and so on — see Section D for the catalogue), the section's typed data (a structured payload whose shape matches the section type), sort order and visibility flag.

**Blog post**
A knowledge-hub article. The system shall capture: slug, title, excerpt, source body (rich text or Markdown), rendered HTML cache, cover image, author, category, status (draft, published or scheduled), scheduled publication time, actual publication time, meta title, meta description and standard timestamps.

**Blog category**
Slug, label, description and sort order.

**Blog post tag**
A many-to-many tag-to-post relationship.

**Area guide**
A managed area guide page. The system shall capture: slug, name, introduction, hero image, the postcode prefixes the area covers (used to filter properties), geographic coordinates, meta title, meta description, status and standard timestamps. Page-builder sections for the area guide use the same structure as page sections.

**Testimonial**
Author name, author role (e.g. "Vendor", "Landlord"), location, rating (one to five), body, source (Google, Trustpilot, manual), source URL, photo, verified flag, sort order, visibility flag, optional link to a branch and creation timestamp.

**FAQ**
Page scope (which vertical page the FAQ appears on), question, answer, sort order and visibility flag.

**Menu**
A named navigation menu (header, footer, mobile). Slug and label.

**Menu item**
A reference to a parent menu, an optional parent item (for nested items), label, URL, target (same window or new), icon, an optional role gate, sort order and visibility flag.

**SEO metadata**
A per-page or per-entity SEO override. The system shall capture: the scope (page, property, area guide, blog post, branch or "default"), the scope identifier, meta title, meta description, canonical URL, Open Graph image, no-index flag, no-follow flag and any structured-data overrides.

**Redirect**
A URL redirect rule. The system shall capture: source path (unique), destination path, type (301, 302, 307 or 410), a hit counter and the most-recent-hit timestamp.

**Media**
A file in the central media library. The system shall capture: original URL, thumbnail URL, file name, MIME type, file size, image dimensions (for images), alt text, caption, folder, the uploading user, a reference count (how many places use the file) and creation timestamp.

**Email template**
Slug, label, subject, preheader, source body (typically a structured email-template format), rendered HTML cache, declared variables and last-update timestamp.

**Notification setting**
For each notifiable event: the event identifier, the channels enabled (email, SMS, in-app, Slack, Teams, webhook), the recipients structure and the template slug.

**Notification log**
A delivery log for every outbound notification. The system shall capture: the event, channel, recipient, template slug, delivery status (queued, sent, failed, bounced, delivered, opened, clicked), provider message identifier, error details and creation timestamp.

**Setting**
A platform-wide or branch-wide configuration value. The system shall capture: a key, a structured value, a description, the last-update timestamp and the user who last updated.

**Consent log**
A GDPR cookie-consent record. The system shall capture: an optional user reference, an anonymous session identifier, the list of consent categories accepted, the client IP and user-agent, and the timestamp.

**Audit log**
An immutable record of every state-changing action in the admin. The system shall capture: actor user, action name (e.g. "property.publish", "user.suspend"), entity type, entity identifier, a structured diff of the change, client IP and user-agent, and the timestamp.

**Subscriber**
A newsletter signup. The system shall capture: email (unique), first name, status (pending, confirmed, unsubscribed, bounced), confirmation timestamp, unsubscribe timestamp, source and creation timestamp.

**Import log**
A record of every bulk-import run. The system shall capture: source identifier (e.g. portal feed, CSV upload), the user who triggered, counts (records input, created, updated, skipped, failed), an error summary, and start/finish timestamps.

### J.8 Data-handling requirements (cross-cutting)

- Every entity that contains personal data shall support GDPR erasure (anonymisation of identifying fields while retaining aggregate audit records).
- Every entity that captures action timestamps shall be subject to the configured retention period (see Section N) — automated purge or anonymisation when the retention window expires.
- All entities shall be exportable for a Subject Access Request, scoped by email address.
- Identifiers shall be globally unique and non-sequential so that they cannot be enumerated.
- The system shall support soft-deletion (hide-don't-purge) for at least: properties, users, contacts and pages.

### J.9 Relationships

The principal relationships across the data model are:

- A property belongs to a branch and is assigned to one or two agents.
- A property has many images and many documents.
- An enquiry may reference a property and an assigned user (staff member).
- A viewing request belongs to a property and may be linked to an originating enquiry.
- A valuation request may be linked to an originating enquiry and to a property record once one is created.
- A repair request is linked to a property (optionally — for the property-not-yet-known case) and to a landlord (for property-managed lettings).
- A user can hold multiple roles, optionally scoped to specific branches.
- A page contains an ordered list of page sections.
- A blog post belongs to a category and may have many tags.
- An area guide owns its own page-section list.
- A media file may be referenced by many entities; deleting media is only permitted when the reference count is zero.

---

## K. Interface capabilities

This section describes the capabilities the platform must expose, grouped by the audience that consumes them. It does not specify a protocol, transport, request shape or response shape — these are implementation choices. Each statement describes a capability the system must provide; the implementation team chooses how to expose it (REST, GraphQL, server actions, gRPC, etc.).

### K.1 Public capabilities (no authentication required)

The system shall expose capabilities for the public website to:

- Retrieve a paginated, filterable, sortable list of published properties (with filters for location, postcode, search radius, sale type, listing type, property category, price range, bedroom range, bathroom range, added-within window, "include under offer", "include sold STC / let agreed", and "new homes only").
- Retrieve the full details of a single published property by its URL slug.
- Retrieve a list of properties related to a given property (typically same area or same vertical).
- Retrieve the list of branches and the details of a single branch.
- Retrieve the list of agents (filterable by department and branch) and the details of a single agent.
- Retrieve the list of area guides and the full content of a single area guide.
- Retrieve a paginated, filterable list of blog posts and the full content of a single post.
- Retrieve the structured content of any managed CMS page by slug.
- Retrieve the structure of any managed navigation menu by slug.
- Retrieve the platform's public settings (non-secret configuration such as social-media links, sticky-bar phone, hours, certification badges).
- Submit a new enquiry of any defined type (general contact, property enquiry, viewing request, valuation request, landlord enquiry, tenant enquiry, repair request, careers application, developer enquiry).
- Submit a newsletter signup (with double opt-in).
- Register a new customer account.
- Sign in to a customer account.
- Sign out.
- Request a password reset and complete a password reset.
- Verify an email address using a one-time token.

Every public capability that accepts user input must verify a challenge-response or behavioural anti-spam token, enforce rate limits, and require a GDPR-consent affirmation where personal data is captured.

### K.2 Customer capabilities (authentication required, customer role)

The system shall expose capabilities for a signed-in customer to:

- Retrieve their own profile and update it.
- Save a property to their account and remove a saved property.
- Retrieve their list of saved properties.
- Create a saved search with a name, set of filters and alert frequency.
- Retrieve, update and delete their saved searches.
- Retrieve their viewing requests and their statuses.

### K.3 Administrative capabilities (authentication required, staff role + relevant permission)

The system shall expose capabilities for authorised staff to perform create, retrieve, update and delete operations on every entity defined in Section J, plus the following specialised operations:

**Properties:**
- Publish, unpublish, archive and duplicate a property.
- Upload and reorder property images.
- Delete a single property image.
- Upload and delete property documents.
- Push a published property to outbound portal feeds.
- Bulk operations across multiple properties: publish, unpublish, feature, archive, assign to agent, change branch, export.

**Leads (CRM):**
- Retrieve a paginated, filterable list of enquiries.
- Update an enquiry's status, assignment, priority and follow-up date.
- Add a threaded note to an enquiry.
- Send a reply to the enquiry's contact (templated, threaded).
- Convert an enquiry into a contact record (buyer, vendor, landlord, tenant) or a viewing request or a valuation request.
- Bulk operations: assign, change status, change priority, add note, archive, export.

**Viewings:**
- Retrieve a calendar or list of viewing requests.
- Create, update and cancel a viewing.
- Confirm a viewing, reschedule a viewing, or mark its outcome (attended, no-show, cancelled).

**Valuations:**
- Retrieve a list and calendar of valuation requests.
- Update a valuation's status, assigned valuer, scheduled visit and outcome.

**Repairs:**
- Retrieve a paginated, filterable list of repair tickets.
- Update a ticket's status, assigned staff, assigned contractor.
- Change a ticket's status via the defined workflow with audit logging.
- Send a templated message to the tenant or contractor; receive replies into the same thread.
- Upload internal documents (quotes, invoices) to a ticket.
- Manage the repair-category taxonomy and contractor list.

**Contacts:**
- Full CRUD on landlord, tenant, vendor and buyer records.
- Detect and merge duplicate contacts.
- Manage compliance items (Right-to-Rent check, AML check, gas safety certificate, EICR, deposit-protection scheme reference) with automatic expiry alerts.

**Team and branches:**
- Full CRUD on agents and branches.
- Manage agent departments and ordering.

**Content management:**
- Full CRUD on managed pages, page sections, blog posts, blog categories, blog tags, blog authors, area guides, testimonials, FAQs.
- Drag-drop reorder of page sections.
- Preview a draft page via a tokenised preview URL.
- Schedule a page or post for future publication.
- Retrieve version history for any page and restore a prior version.

**Site structure:**
- Full CRUD on menus (header, footer, mobile) and menu items.
- Full CRUD on the SEO metadata table and the redirect rules table.

**Media library:**
- Upload files via pre-signed URLs (the application server shall never proxy media bytes).
- Reorder, rename, retag, move between folders, delete (only when reference count is zero).

**Email and notifications:**
- Full CRUD on email templates and SMS templates.
- Manage notification rules (per event, per channel, recipients, throttling).
- Retrieve the notification-delivery log.

**Integrations:**
- Retrieve integration status, masked secrets, and per-integration logs.
- Trigger a test connection for any configured integration.
- Trigger an on-demand sync for any integration that supports it.

**Users, roles and permissions:**
- Full CRUD on users, roles, permissions.
- Invite a new user (by email), suspend a user, reset a user's password.
- Create custom roles by composing permissions.
- "Test as role" — simulate the admin interface as a chosen role for verification.
- Impersonation by a Super Admin (every action audit-logged with both actor identifiers).

**Settings:**
- Retrieve and update platform-wide and branch-scoped settings.
- Manage feature flags and the maintenance-mode toggle.
- Issue and revoke long-lived API tokens for partner integrations.
- Manage outbound webhook subscriptions.

**Audit and reporting:**
- Retrieve the audit log with filters by actor, action, entity, entity identifier, date range, IP and branch.
- Export the audit log.
- Run the GDPR Subject Access Request export tool by email address.
- Run the GDPR Erasure tool by email address (with two-step confirmation).
- Retrieve any of the pre-built reports (Section H.21) with filters.
- Build and save custom reports.
- Schedule a report for periodic email delivery.

**Scheduled tasks:**
- View the list of scheduled jobs with last-run outcome and next-run time.
- Trigger a job manually.
- Pause or resume a job.

### K.4 Outbound integration capabilities

The system shall expose capabilities to:

- Emit configurable outbound webhooks on defined platform events (lead created, viewing confirmed, viewing cancelled, valuation created, repair created, repair status changed, property published, property unpublished, property under offer, property sold, subscriber confirmed and others). Each webhook is signed using a shared secret so receivers can verify authenticity.
- Push published property listings to external property portals on a schedule, in the agreed feed format.
- Receive inbound webhooks from third-party providers (email-provider delivery events, SMS-provider events, payment-provider events) with cryptographic signature verification.

### K.5 Cross-cutting capability requirements

- Every administrative capability shall require the actor to hold the relevant permission, scoped to the actor's branch where the permission is branch-scoped.
- Every state-changing capability shall produce an audit-log entry.
- Every capability that accepts personal data shall enforce GDPR-consent capture.
- Every capability shall validate input against a defined schema before processing.
- Every public capability that accepts user input shall enforce rate limits and anti-spam checks.
- File-upload capabilities shall use pre-signed direct-upload URLs so that media bytes never proxy through the application server.
- Capability responses shall not leak data from other tenants or other users; authorisation checks are mandatory at the data layer, not just at the interface layer.

---

## L. Frontend components

Components are organised by surface (public site / customer account / admin) and within each by reusable atoms → composed molecules → page-level organisms.

### L.1 Public site — global shell

- **`<Header />`** — desktop nav, mobile hamburger trigger, login / register CTAs, sticky utility bar with phone + reviews + WhatsApp.
- **`<MobileMenu />`** — full-screen drawer; same nav items plus property search shortcut, login, create-account.
- **`<Footer />`** — column grid (links / resources / address / hours), social row, certificate badges (linked PDFs), copyright + registration line.
- **`<CookieBanner />`** — modal with Accept All / Reject Non-Essential / Customise.
- **`<StickyValuationCTA />`** — side tab "Get Free Valuation" that opens a multi-step modal.
- **`<ReviewsBadge />`** — "4.x/5 from N reviews" pill.

### L.2 Public site — search & catalogue

- **`<HeroSearch />`** — single-line address/postcode input + sale-type segmented control.
- **`<PropertyFiltersBar />`** — Buy/Rent toggle, listing-type select, city, beds, baths, min/max price, sort.
- **`<PropertyFiltersDrawer />`** — advanced filters (added-within, include-under-offer, include-sold-stc, new-homes-only).
- **`<ActiveFilterChips />`** — removable chips reflecting current filter state.
- **`<PropertyCard />`** — image, status badge, address line, price, beds/baths icons, property type, "added X ago".
- **`<PropertyGrid />`** — responsive grid wrapping `PropertyCard`s.
- **`<PropertyCarousel />`** — horizontal scrollable rail (used on landing pages and "related properties").
- **`<MapView />`** — map-view toggle on `/properties` that pans + plots clustered markers.
- **`<RegistrationBanner />`** — injected into the grid (e.g. position 3) inviting Sign-Up.
- **`<Pagination />`** — first / prev / numbers / next / last + "showing X of Y".

### L.3 Public site — property detail

- **`<PropertyHero />`** — main image with status badge, +N photos overlay, "View All" button.
- **`<PropertyGallery />`** — lightbox with keyboard nav, swipe, pinch-zoom.
- **`<PropertyFactsStrip />`** — icon row: type · beds · baths · status · sqft.
- **`<PropertyHeader />`** — title + town + postcode + sale-type pill + price + qualifier.
- **`<PropertyKeyFeatures />`** — chip list of 3-10 features.
- **`<PropertyDescription />`** — short + long with Read More.
- **`<PropertyActions />`** — Book Viewing / Contact Agent / Save Property.
- **`<PropertyMap />`** — single-marker map, hidden if `hide_exact_address`.
- **`<PropertyNearby />`** — train stations + schools list with distances.
- **`<PropertyDocuments />`** — floorplan, EPC, brochure thumbnails.
- **`<PropertyVirtualTour />`** — iframe embed.
- **`<PropertyVideo />`** — embedded player.
- **`<BookViewingForm />`** — inline + modal variants.
- **`<ContactAgentModal />`** — name, email, phone, message → `enquiries`.
- **`<AgentCard />`** — photo, name, role, phone, email, inline message form.
- **`<PropertyDetailsTable />`** — read-only fact table.
- **`<RelatedPropertiesCarousel />`** — reuses `PropertyCarousel`.

### L.4 Public site — landing pages

- **`<HeroSection />` / `<HeroVideoSection />`** — title, sub-title, CTA, background image or video, optional curve-arrow accent.
- **`<ThreePillarSection />` / `<FourPillarSection />`** — icon + headline + body + optional Learn More.
- **`<TwoColumnSection />`** — image-left or image-right plus rich text.
- **`<StatsCounter />`** — animated counter on IntersectionObserver.
- **`<TestimonialsCarousel />`** — rotating quotes, name, role.
- **`<FAQAccordion />`** — collapsible Q&A list with hash-link deep linking.
- **`<PricingTiers />`** — "Fully Managed / Let Only / Rent Protection" table with feature checks (used on Landlords).
- **`<DevelopmentsGrid />`** — logo + name + town + description (used on New Homes).
- **`<PartnerLogosRow />`** — greyscale logo row.
- **`<CTAStrip />`** — bold band with single CTA.
- **`<ContactInfoBlock />`** — phones per department, address, hours.

### L.5 Forms & inputs (shared)

- **`<TextField />`**, **`<EmailField />`**, **`<PhoneField />`**, **`<TextArea />`**, **`<Select />`**, **`<Combobox />`**, **`<DatePicker />`**, **`<TimeSlotSelector />`**, **`<NumberField />`**, **`<PriceRangeSlider />`**, **`<Checkbox />`**, **`<Radio />`**, **`<FileDropzone />`**, **`<MultiStepForm />`**, **`<FormReviewSummary />`**, **`<AntiSpamChallenge />`**, **`<FormError />`**, **`<FormSuccess />`**.

### L.6 Customer account

- **`<AccountSidebar />`** — Saved Properties, Saved Searches, Viewings, Profile, Alert Settings, Sign Out.
- **`<SavedPropertyCard />`** — reuses `<PropertyCard />` with un-save action.
- **`<SavedSearchRow />`** — name, criteria summary, alert frequency dropdown, run-now, delete.
- **`<ViewingRow />`** — property, date, time, status badge, reschedule/cancel.

### L.7 Admin shell

- **`<AdminSidebar />`** — collapsible nav with all admin sections from Section H.
- **`<AdminTopbar />`** — search, notifications, profile.
- **`<AdminBreadcrumbs />`**.
- **`<AdminDashboardCards />`** — KPI cards: active listings, new leads this week, viewings this week, overdue tickets.
- **`<AdminTable />`** — sortable columns, multi-select, bulk-action bar, pagination, density toggle, column-visibility menu.
- **`<AdminForm />`** — tabbed multi-step forms (used for property edit).
- **`<AdminImageManager />`** — drag-drop reorder, multi-select delete, set-main, alt-text editor.
- **`<AdminFileUpload />`** — pre-signed-URL flow, progress bar, file-type validation.
- **`<StatusBadge />`** — colour-coded enum chip used throughout (status / urgency / role).
- **`<NotificationPanel />`** — slide-over with recent alerts.
- **`<RichTextEditor />`** — a structured rich-text editor; used for the blog body, area-guide rich-text sections, and email-template HTML.
- **`<PageBuilder />`** — drag-drop list of sections; per-section editor pane on the right.
- **`<CalendarView />`** — month / week / day; events filterable by agent.
- **`<ActivityFeed />`** — recent events with actor avatar + verb + timestamp.

### L.8 Shared atoms

- **`<Button />`** with variants `primary | secondary | ghost | destructive | link`.
- **`<Card />`**, **`<Modal />`**, **`<Drawer />`**, **`<Toast />`**, **`<Tooltip />`**, **`<Popover />`**, **`<Dropdown />`**, **`<Tabs />`**, **`<Accordion />`**, **`<Skeleton />`**, **`<EmptyState />`**, **`<Avatar />`**, **`<Badge />`**, **`<Icon />`**, **`<Breadcrumbs />`**, **`<Pagination />`**.

---

## M. UX and visual design system

This section translates the *style of the reference site* into an original design system. The reference's aesthetic is bold-editorial: oversized typography, dark theme accents (`#363636` was its theme-color meta tag), generous full-bleed photography, animated counters, sticky utility bar with phone + reviews badge, and a single property card reused throughout. We carry that posture into an original token set.

### M.1 Design principles

1. **Responsive on every surface, no exceptions.** Every page, every component, every modal, every email — fully responsive from 320 px to 2,560 px. There is no desktop-only screen in this product. The mandate is documented in `design-requirements.md` §0 and enforced by CI guard G11.
2. **Photography is the design.** Property photos and lifestyle shots do the heavy lifting; the chrome around them stays quiet.
3. **One reusable property card.** Search, landing carousels, related rails, saved-list — same card, same anatomy. Consistency over novelty.
4. **Dark accent + warm neutral.** Brand contrast comes from a single saturated accent against warm neutrals; we don't pile on colour.
5. **Editorial typography.** Oversized display headlines on landing pages; quiet, dense type for property detail facts.
6. **Sticky utility at the edges.** Phone, reviews badge, WhatsApp, valuation CTA live in persistent edge surfaces — not in the user's way, always within reach.
7. **Conversion buttons are unmissable.** "Book a Viewing" and "Get a Free Valuation" must read at 3 metres.
8. **Mobile first, fingertip-friendly.** Minimum 44×44 hit targets; one-thumb navigation on every page; touch + mouse + keyboard supported at every breakpoint.

### M.2 Colour tokens

Tokens — not hex literals — get referenced in components. The hexes below are *example values* for a warm-dark-editorial palette; tune to the actual brand once you have it.

```
brand-primary       : #1F2937   (deep charcoal — buttons, headers, badges)
brand-primary-hover : #111827
brand-accent        : #C9A24B   (warm gold — emphasis, hover, focus)
brand-accent-hover  : #B0892F
text-primary        : #1A1A1A
text-secondary      : #4B5563
text-muted          : #6B7280
text-on-dark        : #F9FAFB
surface-base        : #FFFFFF
surface-raised      : #F8F7F4   (warm off-white)
surface-sunken      : #EFEDE6
border              : #E5E2DA
divider             : #E5E7EB

status-available    : #10B981   (green — "For Sale" / "To Rent")
status-under-offer  : #F59E0B   (amber — "Under Offer")
status-sold-stc     : #EF4444   (red — "Sold STC")
status-sold         : #6B7280   (grey — "Sold")
status-let-agreed   : #F59E0B   (amber — "Let Agreed")
status-let          : #6B7280

priority-emergency  : #DC2626
priority-urgent     : #F59E0B
priority-standard   : #3B82F6
priority-low        : #6B7280

success             : #10B981
warning             : #F59E0B
danger              : #EF4444
info                : #3B82F6
```

Token names should be defined as CSS custom properties (e.g. `--colour-{token-name}`) and exposed to the chosen CSS framework or utility library through whatever theming mechanism it provides.

### M.3 Typography

```
font-display       : "Fraunces", "Cormorant Garamond", "Playfair Display", Georgia, serif
font-body          : "Inter", "Helvetica Neue", system-ui, sans-serif
font-mono          : "JetBrains Mono", ui-monospace, monospace

display-xl   : 72/76px,  -0.03em letter-spacing,  weight 400 italic option
display-lg   : 56/60px,  -0.025em
display-md   : 40/44px,  -0.02em
display-sm   : 32/36px,  -0.015em
heading-lg   : 28/32px
heading-md   : 22/28px
heading-sm   : 18/24px
body-lg      : 18/28px
body-md      : 16/24px   <-- base
body-sm      : 14/20px
caption      : 12/16px,  uppercase 0.08em option for badges
```

- **Display** sets the editorial tone — used for hero headlines and section intros. A serif (Fraunces) reads as estate-agent traditional with modern proportions.
- **Body** is Inter — neutral, dense, screen-friendly.
- **Italic** display variants are allowed sparingly on landing pages.

### M.4 Spacing & layout

- **Base unit:** 4px. All spacing values are multiples (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`).
- **Container widths:** `sm:640 / md:768 / lg:1024 / xl:1280 / 2xl:1440`.
- **Page max-width:** `1280px` for content; landing pages use full-bleed sections with inner containers.
- **Section padding:** vertical `80px` on desktop, `48px` on mobile.
- **Grid:** 12-column desktop, 8-column tablet, 4-column mobile, `24px` gutter desktop, `16px` mobile.

### M.5 Component rules

#### Buttons

- **Primary:** solid `brand-primary`, white text, `8px` radius, `12px 24px` padding, `body-md weight-600`. Hover lifts to `brand-primary-hover` and the accent underline fades in.
- **Secondary:** transparent with 1px `brand-primary` border, `brand-primary` text. Hover fills.
- **Ghost:** transparent, no border, `text-primary` colour. Hover sets `surface-raised`.
- **Destructive:** solid `danger`, white text.
- **Link:** no chrome, `brand-accent` text, underline on hover.
- **Sizes:** `sm` 36px, `md` 44px (default — meets accessibility), `lg` 52px.
- **Focus ring:** 3px `brand-accent` at 30% opacity, 2px offset.

#### Inputs

- 1px `border` colour, `8px` radius, `12px 16px` padding, `body-md`.
- Focus: 2px `brand-accent` ring + border colour change.
- Error: 1px `danger` border, helper text below.
- Label above input (not floating) for accessibility.
- Required indicator: subtle asterisk in `text-muted`.
- Disabled: `surface-sunken` background, `text-muted` text.

#### Cards

- **Property card:** `8px` radius, `1px border` on `surface-base`, hover lifts `4px` and `surface-raised` background. Image is `4:3` ratio with status badge top-left and price chip bottom-left. Address line in `heading-sm`, price in `heading-md weight-700`, meta row in `body-sm text-muted`.
- **Generic card:** `12px` radius, `surface-raised`, `24px` padding.

#### Status badges

- Pill shape, `caption uppercase`, `4px 12px` padding, white text on the relevant `status-*` token. Used for both property `market_status` and repair `urgency`.

#### Forms

- Multi-step forms use a horizontal stepper at the top showing completed / current / upcoming steps.
- Submit buttons are full-width on mobile, right-aligned on desktop.
- After submission show `<FormSuccess />` inline (don't redirect away unless going to a dedicated "thank you" page like `/repair-submitted`).

#### Icons

- A single consistent icon library with consistent stroke width across the platform.
- Default size 20px; in nav and buttons 18px; in property facts 16px; in hero sections 32px.

#### Images

- Default ratios: `4:3` for property cards, `16:9` for hero banners, `1:1` for team / testimonial avatars.
- Always lazy-load below the fold; `priority` only for the LCP image.
- Use a responsive-image component that emits modern formats and serves through a CDN with an explicit remote-source allowlist.
- WebP / AVIF served first with JPEG fallback.

#### Motion

- Hover transitions: 150ms ease-out.
- Modal in/out: 200ms ease-out.
- Counter animation: 1500ms ease-out from 0 → target on IntersectionObserver enter.
- Parallax sparingly — only on landing hero images, never on the property catalogue.
- Respect `prefers-reduced-motion`: disable all non-essential animation.

### M.6 Mobile behaviour

- Header collapses to logo + hamburger + tel-icon. Hamburger opens full-screen drawer.
- Property card image grows full-width; meta row stays single-line with truncation.
- Property detail: image hero is full-width swipeable carousel; sticky bottom action bar with Call / Book Viewing / Save.
- Filters drawer opens from bottom on mobile, side on desktop.
- Forms stack to single column. Time-slot selectors become big tappable cards.

### M.7 Accessibility

- **WCAG 2.2 AA minimum.** Target AAA contrast on body text.
- All interactive elements reachable by keyboard with visible focus ring.
- Form fields: `<label>` association, `aria-describedby` for help/error text.
- Skip-to-content link as the first focusable element.
- Image `alt` text mandatory in CMS (admin can't save a property image without alt; a default like "Photograph of [address] — [room name if known]" can be auto-suggested).
- Modals trap focus and restore focus on close.
- Status badges add an `aria-label` like "Status: Under Offer" rather than relying on colour alone.
- Map regions get a textual fallback (`"Map of [address]"`).
- Forms expose validation errors with `role="alert"`.
- Time-slot selectors use real radios under the hood, not just clickable divs.

---

## N. Security and GDPR checklist

### N.1 Authentication & accounts

- Passwords hashed with a modern memory-hard algorithm (such as Argon2id with at least 19 MiB memory cost, 2 iterations and 1 lane of parallelism, or an equivalent OWASP-recommended configuration). Never plain-text, never reversible.
- Password rules: minimum 10 chars, blocked common-passwords list (HaveIBeenPwned k-anonymity check optional).
- **Two-factor authentication** for all staff accounts (TOTP via Authy / Google Authenticator). Mandatory for Super Admin and Branch Manager roles.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, name with `__Host-` prefix.
- Login rate limit: 10 attempts per 15 min per IP and per account; lock account for 30 min after 5 consecutive failures.
- Password-reset tokens: single-use, expire after 60 min, opaque random (32 bytes base64url).
- Email-verification mandatory before "Save Property" / "Saved Search" features work.
- Admin login is on a different path (`/admin/login`) which is rate-limited more strictly and can be IP-allow-listed via a feature flag.

### N.2 Authorisation

- All admin endpoints check the user's permissions via a single middleware (`requirePermission('property.publish')`).
- Branch-scoped roles must enforce branch scoping at the query layer (`WHERE branch_id = ANY (user_branch_ids)`). Never trust the client to filter.
- Multi-tenant separation if you serve more than one agency from one DB — every row has a `tenant_id` and every query includes it.

### N.3 Input validation & sanitisation

- Validate every body with a schema library (Zod / Yup / Joi / Valibot) at the API boundary. Reject unknown fields.
- Treat all user input as untrusted; never pass it directly into SQL or other interpreters — use parameterised queries or an ORM that guarantees the same.
- For free-text fields rendered in HTML, render with auto-escaping by default — never bypass escaping for user content. Sanitise trusted-but-rich content (CMS body fields, rich-text descriptions) through a vetted HTML sanitiser before rendering.
- Output content-security-policy headers including `frame-ancestors 'none'` and a strict `script-src` allowing only your domain + named third-parties.

### N.4 File uploads

- Pre-signed PUT URLs only — never proxy files through your API server. Validate `mime_type` and `size` before issuing the URL.
- Allow-list of MIME types per upload endpoint:
  - Property images: `image/jpeg`, `image/png`, `image/webp`, `image/heic` (max 10MB).
  - Property documents: `application/pdf`, `image/*` (max 25MB).
  - Repair files: `image/*`, `video/mp4`, `video/quicktime` (max 25MB).
  - Career CVs: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (max 10MB).
- Run uploaded files through a virus scanner (ClamAV cluster, or a managed service) before they're marked `public`.
- Re-process uploaded images on the server (sharp / ImageMagick) — strip EXIF, re-encode — to neutralise embedded payloads and to remove location metadata.

### N.5 Rate limiting & spam protection

- All public POST endpoints rate-limited: 5 req/min/IP for enquiries, 10/min/IP for auth, 20/min/IP for newsletter.
- A challenge-response or behavioural anti-spam token is required on every public form; the token must be verified server-side before any processing occurs.
- Honeypot field on each form — a hidden `website` or `address2_dummy` input that bots fill but humans don't; reject submissions where it's non-empty.
- Time-based check: reject submissions less than 2 seconds after the page loaded (likely a bot).

### N.6 GDPR & data handling

- **Lawful basis** declared per processing activity (contact form: legitimate interest / consent; marketing: explicit consent; viewings: contract performance).
- Every form has an unticked GDPR consent checkbox (or, where consent isn't the lawful basis, a clear privacy notice link). Marketing opt-in is a separate, unticked checkbox.
- Privacy policy page must list every category of data collected, retention period, and recipients.
- **Data subject rights endpoints** (staff-mediated is fine for a small agency, but build the supporting queries):
  - **Access** (Subject Access Request) — export everything we have on `<email>` as JSON.
  - **Rectification** — staff can edit any contact's record.
  - **Erasure** (Right to be Forgotten) — anonymise enquiries (`name`, `email`, `phone` → `[erased]`) and delete attached files; keep aggregate records for legal/financial obligations.
  - **Portability** — same as access.
- Retention policies (configurable in `settings`):
  - Enquiries: 24 months from last activity, then anonymise.
  - Tenancies: 7 years (HMRC requirement).
  - Saved searches / saved properties: until the user deletes their account.
  - Audit logs: 7 years.
  - Search logs / consent logs: 13 months.
- Cookie banner: granular consent (necessary / analytics / marketing / preferences); load tracking scripts conditionally; log every consent decision with timestamp + IP + UA.
- **Data Processor Agreements** with every third party that handles personal data (email provider, SMS provider, object storage, analytics).
- **EEA / UK data residency:** all storage of personal data must be in UK or EU regions. If any non-UK/EU sub-processor is used, document the Standard Contractual Clauses or UK International Data Transfer Agreement in place.

### N.7 Forms & notifications matrix

This consolidates section 9 of the brief. Every form on the site, with its rules.

| Form                       | Required fields                                                  | Validation                                       | Spam       | DB write                                                | Admin notification                                         | User confirmation        | Success                       | Error                       | GDPR consent           |
|----------------------------|------------------------------------------------------------------|--------------------------------------------------|------------|---------------------------------------------------------|-------------------------------------------------------------|--------------------------|-------------------------------|-----------------------------|------------------------|
| General Contact            | name, email, phone, department, message                          | email regex; phone E.164; message 10–2000 chars  | anti-spam challenge + honeypot | `enquiries (type=general_contact)`                       | Email to department inbox                                  | Confirmation email       | Inline + thank-you             | Inline field errors          | Required tick          |
| Property Enquiry           | name, email, phone, message; property_id from URL                | as above                                         | as above   | `enquiries (type=buyer_enquiry)`                         | Email to assigned agent + branch                           | Confirmation email       | Inline thank-you in modal      | Inline                       | Required tick          |
| Book Viewing               | name, email, phone, preferred_date, preferred_time_slot          | date ≥ tomorrow; slot in allowed list            | as above   | `enquiries (type=viewing_request)` + `viewing_requests`  | Email to agent + branch with calendar (.ics)               | Confirmation email + ICS | Inline                         | Inline                       | Required tick          |
| Book Valuation             | name, email, phone, address, postcode, intent, timescale         | postcode regex; intent enum                      | as above   | `enquiries (type=seller_valuation)` + `valuation_requests`| Email to valuations@                                       | Confirmation email       | Multi-step success page        | Per-step                     | Required tick          |
| Landlord Enquiry           | name, email, phone, address, current_status, message             | as above                                         | as above   | `enquiries (type=landlord_enquiry)`                      | Email to lettings@                                         | Confirmation email       | Inline                         | Inline                       | Required tick          |
| Tenant Enquiry             | name, email, phone, budget, move_in_date, message                | budget numeric                                   | as above   | `enquiries (type=tenant_enquiry)`                        | Email to lettings@                                         | Confirmation email       | Inline                         | Inline                       | Required tick          |
| Repair Request             | name, email, phone, address, category, description, urgency, access_permission, photos[] | per-step schema validation                       | as above + file MIME check | `enquiries` + `repair_requests` + `repair_files`        | Email to PM + branch repairs; SMS to on-call if emergency  | Confirmation email + ticket ID; SMS if emergency | Success page with ticket # | Per-step inline | Required tick |
| Career Application         | name, email, phone, role, cv_file, cover_letter                  | CV PDF/DOCX ≤ 10MB                               | as above   | `enquiries (type=career_enquiry)` + `applications`       | Email to HR with attachments                               | Confirmation email       | Inline                         | Inline                       | Required tick          |
| Newsletter Signup          | email; optional first_name                                       | email regex                                      | anti-spam challenge only | `subscribers (status=pending)`                          | None — automated double opt-in                             | Double opt-in email      | "Check your email"             | Inline                       | Required tick          |
| Register                   | name, email, password, password_confirmation                     | password rules; email uniqueness                 | anti-spam challenge  | `users`                                                   | None                                                       | Email verification       | "Check your email"             | Inline                       | Required tick          |

### N.8 Audit & backup

- Every state-changing admin action writes an `audit_logs` row (actor, action, entity, entity_id, diff, IP, UA).
- **Backups:**
  - Database: daily full + hourly WAL / point-in-time recovery; retain 30 days; off-region copy weekly.
  - Object storage: bucket-versioning enabled; lifecycle policy retains deletions for 30 days.
  - Tested restore drill quarterly.
- **Secrets management:** environment variables sourced from a secret manager (AWS Secrets Manager / Doppler / 1Password Secrets / Vault). No secrets in git.
- **Dependency hygiene:** Renovate / Dependabot, weekly scan; npm-audit / Trivy in CI; block merge on high/critical CVEs.

### N.9 Operational security

- HTTPS everywhere; HSTS with preload (`max-age=63072000; includeSubDomains; preload`).
- Force redirect HTTP → HTTPS.
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()`.
- Logging: structured JSON to a log aggregator (Logtail / Better Stack / Datadog / OpenSearch). Never log secrets, passwords, full card numbers, PII beyond what's necessary.
- Error monitoring: a structured error-monitoring product with PII scrubbing rules enabled.

---

## O. SEO checklist

### O.1 URLs

- Property URLs follow the pattern `/properties/{street-or-building}-{town}-{postcode-prefix}[-{disambig}]`, e.g. `/properties/manchester-drive-leigh-on-sea-ss9-4`. Slug is generated from `title`, `town`, `postcode_prefix` with a numeric disambiguation suffix if collision.
- Area-guide URLs: keep both `/locations/{slug}` (canonical) and an SEO-friendly rewrite `/houses-for-sale-{slug}` / `/flats-to-rent-{slug}` that 301s to the canonical (or vice versa).
- Trailing slashes: pick one convention and stick to it; redirect the other.
- Lowercase URLs only; reject uppercase variants with 301.

### O.2 Metadata

- `<title>` per page (≤ 60 chars), dynamically built — property example: `{title} — {town}, {postcode_prefix} | {agency} Estate Agents`.
- `<meta name="description">` (≤ 160 chars).
- `<link rel="canonical">` on every page; for property detail, always include the canonical even on filter/UTM variants.
- `<meta name="robots" content="...">` with `index, follow` by default; `noindex` for system / preview pages.
- **Open Graph + Twitter Card** on every page: `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type`, `twitter:card=summary_large_image`.

### O.3 Structured data (JSON-LD)

- **`RealEstateListing`** on every property page with `name`, `description`, `url`, `image`, `numberOfBedrooms`, `numberOfBathroomsTotal`, `floorSize`, `geo`, `address` (PostalAddress), `offers` (Offer with `price`, `priceCurrency`, `availability`).
- **`RealEstateAgent`** (an `Organization`) on the homepage / contact page with `name`, `image`, `logo`, `address`, `geo`, `telephone`, `email`, `priceRange`, `aggregateRating`, `openingHoursSpecification`, `sameAs` (social URLs), `areaServed`.
- **`BreadcrumbList`** on every nested page.
- **`Article`** on every blog post with `headline`, `author`, `datePublished`, `dateModified`, `image`, `publisher`.
- **`FAQPage`** on landing pages with FAQ accordions.
- **`Place`** / **`TouristAttraction`** schema on area guides where appropriate.
- **`Person`** schema for staff profiles.

### O.4 Sitemap & robots

- `/sitemap.xml` is a sitemap index pointing at:
  - `/sitemap-properties.xml` (regenerated on publish/unpublish)
  - `/sitemap-pages.xml` (CMS pages)
  - `/sitemap-news.xml` (blog posts; supports `<news:news>` extensions if Google News submitted)
  - `/sitemap-area-guides.xml`
  - `/sitemap-team.xml`
- `lastmod`, `changefreq`, `priority` on every URL.
- `/robots.txt` allows everything except `/admin`, `/account`, `/account/*`, `/api/*`, `/preview/*`, and references the sitemap.

### O.5 Performance (which is SEO)

- **Core Web Vitals targets:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.
- Server-render or statically generate property pages; revalidate on publish/update (ISR / on-demand revalidation).
- Use a CDN in front of every public asset.
- Image optimisation: WebP/AVIF, `width`/`height` attributes, `loading="lazy"` below the fold, `priority`/`fetchpriority="high"` on the LCP image.
- Critical CSS inlined; non-critical CSS deferred.
- JS budget per route ≤ 200KB compressed; use route-level code-splitting.
- Use `font-display: swap` and preload one woff2 per font face.
- Preconnect to CDN, map tiles, analytics.
- Avoid render-blocking third-party scripts; load them after consent and after `load`.

### O.6 Internal linking

- Every property links to its area guide; every area guide lists current properties in that area; every blog post linking to a relevant area / vertical landing page.
- Footer has a column of "Useful Links" repeating the major navigation.
- "Related Properties" carousel on every property detail.
- "Latest Properties" carousels on every vertical landing page.

### O.7 Local SEO

- One branch page per office at `/branches/[slug]` with `LocalBusiness` schema, embedded map, phones, hours, photos.
- A locations index at `/locations` linking to all area guides.
- NAP (Name, Address, Phone) consistent across the site, footer and Google Business Profile.

### O.8 Image alt-text discipline

- Property images: `"Photograph of [property title], [town] — [room or angle]"` auto-suggested; admin can override.
- Team photos: `"Portrait of [name], [role]"`.
- Decorative images get `alt=""`.

### O.9 Redirects

- Maintain a `redirects` table; admin can add 301s for any URL change.
- Auto-generate a 301 from the previous slug when a property's slug changes.
- Auto-generate a 301 from the old area-guide slug if renamed.

---

## P. Technology requirements (implementation-neutral)

This section deliberately names no specific framework, library, hosting provider or vendor. The technology implementation is an open decision to be made when the team's operational capacity, target customer profile and year-1 tenant count are confirmed. What this section captures instead is the **set of technology capabilities the platform must provide** and the **build-vs-buy decisions** the team must make per module.

### P.1 Required technology capabilities

The chosen implementation, whatever it is, must provide:

- A server-rendered web application capable of strong SEO performance on the public site, with the ability to revalidate or rebuild individual property pages on publish without redeploying the whole site.
- A relational database with strong consistency and the ability to enforce per-tenant schema or row isolation. Postgres-class capability is assumed.
- A geographic / spatial query capability for radius and area-prefix property searches.
- A scalable object-storage capability for images, floorplans, EPCs, brochures and repair-ticket attachments, with the ability to issue pre-signed upload URLs so that media never proxies through the application server.
- A content-delivery network in front of media for efficient global delivery of property images.
- A transactional email capability with high deliverability for confirmations, alerts and notifications.
- An SMS capability for emergency repair tickets and (optionally) two-factor authentication.
- A spam-protection capability for public forms (challenge-response or behavioural).
- An interactive mapping capability with vector tiles, geocoding and reverse-geocoding.
- A web-analytics capability that respects cookie consent.
- An error-monitoring capability that captures client- and server-side exceptions and tags them by tenant.
- A structured-logging capability with per-tenant filtering.
- A background-job capability for scheduled tasks (saved-search alerts, sitemap regeneration, recurring maintenance tickets, billing rollups).
- A secrets-management capability so that credentials are never stored in code or in environment variables on developer machines.
- A continuous integration and deployment capability with automated test gates.

### P.2 Build-vs-buy decisions per module

For each module below the platform team must make an explicit build-or-integrate decision.

| Module | Build first-party | Or integrate an existing service | Driver for the decision |
|---|---|---|---|
| Property data / CRM | Possible (covered by this spec) | Several established UK estate-agency CRM products exist | Build if the goal is product differentiation; integrate if the team already operates one of the established products and only needs a new front end |
| Repair / maintenance ticketing | Possible (Section G) | Established repair-ticketing products exist | Integrate is the fast path; build if a native, branded experience is a buying criterion |
| Instant property valuation | Basic automated valuation can be built using public Land Registry data | Specialist valuation widgets and AVM services exist | Integrate — the comparable-sales dataset is the moat |
| Tenant referencing / AML / Right-to-Rent | Not recommended to build | Specialist regulated services exist | Integrate — regulatory burden is too high to absorb |
| Rent collection and payment | Not recommended to build | Specialist rent-collection services and payment processors exist | Integrate — payment regulation, fraud, chargebacks are out of scope |
| Document signing | Not recommended to build | Established e-signature services exist | Integrate |
| Live chat | Optional — could be a simple messaging deep-link or an integrated chat product | Established chat products exist | Integrate if real-time chat is a buying criterion; messaging deep-link is sufficient otherwise |
| Reviews aggregation | Not recommended to build | Established reviews-aggregation services and Google Business Profile API exist | Integrate |
| Knowledge hub (blog) | Recommended to build as part of the platform CMS | A separate blog product could be used | Build — splitting the CMS across two systems creates editorial overhead |
| Portal syndication outbound feed | Recommended to build | Some CRM products provide this out of the box | Build — the syndication feed format is a known standard |

### P.3 Capability matrix dependencies

Several requirements in this specification depend on technology capabilities being chosen. Where a section of this document references a capability (for example "background-job-driven email alerts" or "object-storage pre-signed upload"), that reference is to be read as a requirement satisfied by whichever implementation choice the team makes, not as a recommendation of a specific product.

### P.4 What is intentionally not specified

- The web application framework, language or runtime.
- The database product or hosting service.
- The object-storage product, CDN, email provider, SMS provider, mapping provider, analytics provider, error-monitoring product, logging product or CI/CD product.
- The deployment pipeline or infrastructure-as-code tooling.

These remain implementation choices to be made when the architecture is committed.

---

## Q. Build roadmap (functional phases)

The platform is delivered in phases. Each phase below captures **what must be true at the end of the phase** — its outcomes, the features included, the dependencies between phases, and the acceptance criteria the team will measure against. Estimated effort is given in size bands (Small, Medium, Large, Extra-Large) rather than days, because the team and tooling are not yet selected.

### Q.1 Phase 1 — Core marketing site

- **Outcomes:** The platform's public marketing pages render end-to-end. A non-developer can edit every visible piece of editorial copy without involving engineering. Visitors can read content, find the agency, and submit a general contact form.
- **Features included:** Portal homepage; vertical landing pages (Sales, Tenants, Landlords, Sellers, New Homes, Commercial, Business Transfer, optional Care Homes); Team page; Locations index; Knowledge hub; legal pages; contact page; global header, footer, mobile menu, sticky utility bar, cookie banner; page-builder CMS with the minimum section types (hero, three-pillar, stats, testimonials, FAQ, video, CTA strip, rich text, contact info).
- **Dependencies:** Data requirements for pages, page sections, agents, branches, testimonials, FAQs, blog posts, settings, users, roles, permissions (Sections D, J).
- **Estimated effort:** Large.
- **Acceptance criteria:**
  - A non-developer can edit every visible editorial element from the admin without a deploy.
  - The home page meets the performance targets in Section O.5.
  - The cookie banner enforces granular consent before any analytics or marketing scripts load.
  - The mobile menu is fully keyboard-navigable and screen-reader friendly.
  - The legal pages (Privacy, Complaints, Terms, Cookies) are all editable through the CMS.

### Q.2 Phase 2 — Property listings and search

- **Outcomes:** Properties can be browsed, searched, filtered, sorted and viewed on the public site. The data model defined in Section F is fully populated and exposed.
- **Features included:** Property entity with full attribute set; property images and documents; property detail page; unified `/properties` search with filters, sort and pagination; related-properties carousel; structured data; XML sitemap; area-guide pages with linked properties; interactive map on the detail page; image gallery with lightbox.
- **Dependencies:** Phase 1.
- **Estimated effort:** Large.
- **Acceptance criteria:**
  - A representative seeded dataset of 100+ properties is browseable, with every documented filter combination returning correct results.
  - Direct URL with filter parameters reproduces the same view (URL is the source of truth for search state).
  - The property detail page emits valid structured data that passes the Google Rich Results test.
  - The image gallery is fully keyboard-navigable.
  - The XML sitemap regenerates within 60 seconds of any publish or unpublish event.

### Q.3 Phase 3 — Administrative dashboard

- **Outcomes:** Staff can manage properties, content, team, branches, testimonials, FAQs, area guides, blog posts, menus, SEO metadata and settings from a single administrative interface, with role-based access control.
- **Features included:** Admin shell (sidebar, topbar, breadcrumbs); property CRUD with the multi-tab editor; drag-drop image manager; document uploader; CRUD for every other CMS entity; menus and footer management; per-page SEO metadata management; site-wide settings; user and role management with permission matrix; audit log of all state-changing actions.
- **Dependencies:** Phase 1 + Phase 2.
- **Estimated effort:** Extra-Large.
- **Acceptance criteria:**
  - A new property can be created end-to-end from the admin (with photos) in under 5 minutes by a trained user.
  - Role-based permissions are enforced at the data layer, not just the UI: a Sales role cannot modify a Lettings property even by directly invoking the underlying capability.
  - Every state-changing administrative action writes an audit-log entry.
  - Drag-drop reordering of property images persists order across reload.
  - The page-builder can compose any of the vertical landing pages defined in Section C.

### Q.4 Phase 4 — Enquiries and CRM

- **Outcomes:** Every public form on the site produces a structured lead in the CRM. Staff can triage, assign, communicate with and progress every lead from one interface.
- **Features included:** All public forms (contact, property enquiry, viewing, valuation, landlord, tenant, developer, commercial, business, careers); the unified CRM queue with filtering, sorting and saved views; lead assignment and status workflow; notes and follow-up dates; email templates; transactional email sending; calendar attachment for viewings; calendar view of viewings and valuations.
- **Dependencies:** Phase 3.
- **Estimated effort:** Large.
- **Acceptance criteria:**
  - Every public form submission lands in the CRM with the correct lead type, source page and (if available) campaign attribution.
  - Confirmation email arrives at the user within 60 seconds of submission.
  - A viewing request includes a valid calendar attachment that imports correctly into the major calendar applications.
  - The CRM queue can be filtered by status, assignee, branch, source and date range.

### Q.5 Phase 5 — Repair reporting system

- **Outcomes:** Tenants can report maintenance issues end-to-end with photo and video uploads. Staff can triage, assign, communicate, dispatch contractors, and close repair tickets.
- **Features included:** The multi-step tenant-facing repair form (Section G); media upload via pre-signed direct upload; the repair inbox; status workflow; contractor portal with magic-link access; internal threaded messaging; SLA badge logic; configurable repair categories and urgency taxonomy.
- **Dependencies:** Phase 4 (shares the email and storage subsystems).
- **Estimated effort:** Large.
- **Acceptance criteria:**
  - A tenant on a mid-range mobile device can submit a ticket with five photos in under 90 seconds.
  - An emergency-urgency ticket triggers all configured emergency channels simultaneously (email, SMS, in-app, team messaging).
  - A contractor can mark work as complete from the contractor URL without logging in to the main admin.
  - The SLA badge transitions colour at the configured percentage thresholds.

### Q.6 Phase 6 — Customer accounts and saved data

- **Outcomes:** Registered customers can save properties, save searches with email alerts, and view their viewing history.
- **Features included:** Register, sign-in, sign-out, password reset, email verification; customer account area; saved-property and saved-search persistence; email alerts at configured frequencies.
- **Dependencies:** Phase 2 (catalogue) and Phase 4 (email).
- **Estimated effort:** Medium.
- **Acceptance criteria:**
  - A user can save a property from a card without navigating away.
  - A daily-frequency saved-search alert is emailed only when there are new matches since the previous alert.
  - Account deletion fully anonymises personal fields and removes saved data within 24 hours.

### Q.7 Phase 7 — Advanced SEO, observability and outbound integrations

- **Outcomes:** The platform is search-engine-optimised, observable in production, and exchanges data with the major property portals.
- **Features included:** Structured data for all entity types; redirect-rule editor; dynamic Open Graph image generation; analytics, error-monitoring and structured-logging wired up tenant-aware; outbound portal-syndication feed; performance budget enforcement in the build pipeline.
- **Dependencies:** All previous phases.
- **Estimated effort:** Medium.
- **Acceptance criteria:**
  - All property pages produce valid Rich Results in Google Search Console.
  - The performance budget gate fails the build if any route exceeds the published thresholds.
  - The outbound portal-syndication feed validates against the chosen portal's published schema.

### Q.8 Phase 8 — Optional follow-ons

- **Features included:** Bulk property import from CSV / XML / scheduled feeds; reviews aggregation widget pulling from external review sources; in-platform workflow automations ("when a valuation is marked completed, send a follow-up email after 7 days"); A/B testing of page-builder sections; expansion of the contractor portal; multi-language; multi-currency.
- **Dependencies:** All previous phases.
- **Estimated effort:** Medium to Large per follow-on.

---

## R. Cross-cutting requirements (definition of done and ways of working)

This section captures the cross-cutting requirements that govern *how* the platform is built and maintained — independent of any one feature. They are written as requirements the team and the platform must satisfy, not as implementation recipes.

### R.1 Definition of done (per feature)

A feature is considered "done" only when all of the following are true:

- All requirements in the relevant section of this document are satisfied and demonstrable.
- Database changes are applied via a reversible, versioned migration mechanism. Migrations run cleanly on a fresh database and on a copy of staging.
- Every public-facing form path is covered by an automated end-to-end test.
- Every state-changing capability emits an audit-log entry.
- A manual accessibility check has been performed on the new flow using a screen reader.
- The relevant performance budget is still met after the change.
- The change is documented for both the engineering team (in-repo) and, where it affects how staff use the admin, for staff (in the admin's help content).

### R.2 Domain glossary

This vocabulary is reused across requirements, the data model, capabilities, the user interface and the CMS. The platform must use this terminology consistently:

- **Property** — any listing, regardless of vertical (residential, new home, commercial, business transfer, care home, land).
- **Listing type** — the discriminator above.
- **Sale type** — for sale, or to rent.
- **Market status** — the current state of the listing in the market (available, under offer, sold subject to contract, sold, let agreed, let, withdrawn).
- **Branch** — a physical office of the agency.
- **Agent** — a staff member shown on the public Team page; may or may not be a User.
- **User** — anyone who can authenticate (staff or customer).
- **Vendor** — the UK estate-agency term for a property seller.
- **Applicant** — someone enquiring on or viewing a property (not "customer", which is reserved for registered account holders).
- **Tenant** — a current or prospective renter.
- **Landlord** — the owner of a property being let.
- **Enquiry** — any inbound lead, regardless of source.
- **Viewing** — a scheduled visit by an applicant.
- **Valuation** — a market appraisal of a property.
- **Repair** or **Ticket** — a maintenance request.

### R.3 Open questions to resolve before construction

The following questions must be answered before the implementation team commits to an architecture and starts building:

1. How many branches will be live at launch? (Affects the branch-picker UI and assignment-rules editor.)
2. Will property data be imported from an existing CRM at launch? If so, in what format?
3. Will the instant valuation be a first-party multi-step form, or will it embed a third-party valuation widget?
4. Will repairs be a first-party module or will the platform integrate an established repairs product?
5. Is a niche / luxury sub-brand vertical required from launch (the optional sixth portal tile)?
6. Which transactional-email provider and which SMS provider will be used?
7. Which interactive-map provider will be used? (Drives cost and tile-licensing decisions.)
8. Will real-time chat be offered? If so, via an embedded chat product or via a messaging deep-link?
9. Will the newsletter be operated through the platform's own subscriber list, or fed into an external audience management product?
10. Is multi-language or multi-currency required at launch? (Default answer is no — confirm.)
11. Is outbound portal syndication required at launch, and to which portals?
12. What are the agency's office hours, after-hours appointment policy and on-call rota for emergency repairs?

### R.4 Closing acceptance — when is the specification implemented?

The specification is considered implemented when:

- Every page listed on the sitemap in Section C has a corresponding route in the live application.
- Every feature in the audit table in Section B has a corresponding implementation or an explicit, documented deferral.
- Every entity in Section J is captured and queryable with the attributes described.
- Every capability in Section K can be exercised by the relevant audience.
- Every form in Section N.7 produces the expected database write and the expected notification.
- Every component in Section L exists in the live front end.
- The design tokens in Section M are exposed as theme variables to the live front end.
- Every checklist item in Sections N (security and GDPR) and Section O (SEO) is verified to pass before launch.
- Every requirement in Section S (hosting and multi-tenancy) is demonstrably satisfied by the chosen architecture.

---

## S. Non-functional requirements for hosting and multi-tenancy

The platform is sold as a SaaS — each agency that buys the product gets their own isolated environment. This section describes **what the hosting platform must achieve**, not how it must be built. The implementation (pure hyperscaler, hybrid managed services, or pure self-hosted) remains an open architectural decision to be made when target customer profile, year-1 tenant count and team operational capacity are known.

### S.1 Multi-tenancy requirements

- Each tenant (estate agency) shall operate in a logically isolated environment with its own primary URL, its own administrator credentials, and its own dataset.
- A fault, security compromise, performance problem or runaway query in one tenant's environment shall not affect the availability, integrity or confidentiality of any other tenant's environment.
- A tenant shall not be able to read, write, enumerate or infer the existence of any data, file, configuration value or user belonging to another tenant through any public or authenticated interface.
- The platform shall support tenant-level branding, custom domains and tenant-specific configuration without code changes.
- Provisioning a new tenant or deprovisioning an existing tenant shall not require downtime for any other tenant.

### S.2 Cost requirements

- Infrastructure cost per active tenant shall remain commercially viable at the chosen subscription price (target: marginal cost per tenant should not exceed 25% of the smallest plan's monthly fee).
- Marginal cost of an additional tenant shall decrease, not increase, as the tenant pool grows.
- The platform shall not incur substantial cost for tenants that are idle. Where the chosen architecture supports it, idle tenants should be scaled down or paused automatically.
- Storage costs shall scale linearly with stored data (no fixed per-tenant storage minimums where avoidable).
- Bandwidth and egress costs shall be predictable and monitored per-tenant.

### S.3 Availability requirements

- The platform shall target 99.5% monthly availability per tenant in year 1, measured at the public site URL.
- The platform shall have a documented path to 99.9% monthly availability by year 2 or before the first enterprise contract whose SLA requires it.
- A failure of one tenant's environment shall not affect the availability of any other tenant.
- A failure of any shared infrastructure component shall not cause data loss; recovery may temporarily reduce availability but must be a recoverable event, not a permanent one.
- Planned maintenance shall be communicated to tenants in advance and performed in low-traffic windows.

### S.4 Recovery requirements

- Any tenant's data shall be recoverable to any point within the previous 30 days.
- A complete tenant restore (database plus media) shall be achievable within 4 hours of a written request.
- Backups shall be tested at least quarterly via a documented restore drill.
- The recovery procedure shall be documented and runnable by any qualified engineer on the operations team — not dependent on a single person.
- Backups shall be stored in a region or storage account separate from the live data so that a regional failure or a logical corruption cannot destroy both.

### S.5 Provisioning requirements

- A new tenant signup shall reach a usable administrator login within 10 minutes of the signup being authorised.
- Provisioning shall be fully automated for the default case (no manual operator intervention required).
- Provisioning shall be idempotent: a partial failure shall leave no orphaned resources and the workflow shall be re-runnable to converge to the correct state.
- If provisioning fails irrecoverably, the platform shall alert the operations team within 5 minutes and mark the tenant in a clearly distinguishable "failed" state so that no billing is initiated.
- Deprovisioning shall be reversible during a defined grace period (recommended 90 days) and irreversible thereafter, with both behaviours clearly distinguished in the tenant lifecycle.

### S.6 Custom domain requirements

- Tenants shall be able to use their own domain (for example `agencyname.co.uk`) from launch day. This is a buying criterion — agencies will not adopt a platform that requires them to abandon their existing domain.
- The platform shall guide the tenant through any DNS configuration steps required on their side (for example, adding a CNAME or validation record at their domain registrar).
- SSL/TLS certificates for custom domains shall be auto-issued and auto-renewed without operator intervention.
- The default platform subdomain (e.g. `agencyname.platformdomain.co.uk`) shall continue to work alongside any custom domain that has been added.
- The platform shall handle www and apex-domain variants consistently, with HTTPS-only redirects where applicable.

### S.7 Data residency and compliance requirements

- All tenant personal data (anything that identifies an individual — contacts, enquiries, viewings, repair tickets, account holders) shall reside in UK or EU regions.
- The hosting platform shall hold (or inherit) the certifications required by the target customer profile. For UK estate agencies, this typically means: ICO registration, GDPR-compliant data processing, documented sub-processors. For enterprise customers (large agency groups, franchise networks, institutional property owners), this may extend to SOC 2 Type II or ISO 27001.
- Data Processor Agreements shall be in place with every third party that handles personal data on the platform's behalf.
- The platform shall be capable of geographically segregating tenants if required by future contractual obligations.
- Personal data shall be encrypted at rest and in transit.
- The platform shall provide tenants with a documented sub-processor list and notify them in advance of any changes.

### S.8 Scalability requirements

- The platform shall scale from 1 to 100 tenants without architectural change.
- The platform shall have a documented and tested scaling plan from 100 to 1,000 tenants.
- The platform shall scale compute up and down with actual tenant activity. A tenant whose traffic doubles shall not require manual intervention to remain performant.
- A spike in one tenant's traffic shall not degrade another tenant's experience.
- The platform shall expose per-tenant resource consumption metrics so that capacity decisions are evidence-based.

### S.9 Operational sustainability requirements

- Platform operations shall not require more than one full-time engineer's attention at 100 tenants. Beyond that, the operations team shall scale sub-linearly with tenant count.
- Routine maintenance — operating system patching, certificate rotation, backup verification, log rotation — shall be automated.
- The platform shall emit structured logs and metrics that allow per-tenant filtering for support and incident response.
- An on-call rota and incident response procedure shall be documented before the first paying tenant goes live.
- Runbooks shall exist for: provisioning a tenant manually, restoring a tenant from backup, suspending and reactivating a tenant, rotating platform secrets, handling a regional failure, responding to a security incident.

### S.10 Tenant lifecycle requirements

- The platform shall support tenant states of at least: provisioning, active, suspended, deprovisioning, deleted, and provisioning failed.
- Suspension shall preserve all tenant data while making the public site unavailable and stopping billing.
- A suspended tenant shall be restorable to active state for at least 90 days following suspension.
- Deletion shall be permanent and shall remove all personal data from live storage within a defined window (recommended 30 days), with anonymised audit records retained for legal compliance.
- All lifecycle state changes shall be recorded in an audit trail with timestamp, actor and reason.

### S.11 Observability requirements

- Every log entry, error report and trace shall be tagged with the tenant identifier so that support staff can investigate per-tenant issues without searching unrelated data.
- The platform shall surface per-tenant health metrics (request rate, error rate, latency percentiles, database query duration) accessible to the operations team.
- The platform shall alert the operations team when a tenant's error rate, latency or availability deteriorates beyond defined thresholds.
- The platform shall track per-tenant resource consumption (compute time, storage, bandwidth, email volume) for the purposes of billing and capacity planning.

### S.12 Billing and metering requirements

- The platform shall capture per-tenant usage daily for the metrics needed by the chosen pricing model: at minimum, active listings, media storage, bandwidth egress, and outbound email volume.
- The tenant administrator shall be able to view their current-period usage and projected overage in their own admin interface.
- Plan changes (upgrade, downgrade, suspension) shall take effect at clearly-defined billing boundaries and shall be reflected in subsequent invoices.
- The platform shall integrate with the chosen billing provider so that subscription, invoicing and payment-failure events flow through to tenant lifecycle.

### S.13 Hosting options under consideration (informative only)

The following hosting models all satisfy the requirements above in principle. The committed implementation is **pure self-hosted on Hetzner** (see below).

| Model | Indicative cost profile | Operational burden | Compliance posture |
|---|---|---|---|
| Pure hyperscaler (managed services from a major cloud provider) | Highest | Lowest | Strongest (inherited certifications) |
| Hybrid (rented compute combined with managed data and edge services) | Moderate | Moderate | Moderate (depends on chosen managed services) |
| **Pure self-hosted (rented dedicated servers under full team control) — COMMITTED** | **Lowest** | **Highest** | **Weakest (team must achieve compliance independently)** |

The cost saving of moving away from a pure hyperscaler can be substantial (60–80% at scale), but is only realised if the team has the operational capacity to absorb the work the hyperscaler would otherwise have done. The hybrid model is the typical answer for cost-sensitive B2B SaaS that needs to keep operational burden manageable.

### S.13a Committed implementation — pure self-hosted on Hetzner

The team has committed to the pure-self-hosted model. The chosen stack is recorded authoritatively in `AGENTS.md` §9 / `CLAUDE.md` §9. Summary:

- **Compute:** Hetzner dedicated server (AX/CCX class), Dockerised containers, deployed via Coolify or Dokku.
- **Database:** PostgreSQL 16 + PostGIS, on the same Hetzner host. Shared DB with Row-Level Security for multi-tenancy.
- **Object storage:** Local filesystem on the Hetzner host (no S3 / R2 / MinIO dependency). Files served via signed-token middleware. `restic` snapshots to a separate Hetzner Storage Box for backup