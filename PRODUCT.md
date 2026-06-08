# PRODUCT — Naming, tier model, compliance, brand voice

This document is the authority for **what we call things**, **what plans we sell**, **what compliance rules govern us**, and **how we sound to customers**. Every other document — code, brief, design, copy — must obey it.

## 1. Project identity

- **Project name:** Estate Agent Platform (working title — confirm before launch).
- **One-line description:** A multi-tenant SaaS platform that gives UK estate agencies a complete public website, property catalogue, lead management, repair ticketing, customer portal and admin dashboard, with strong per-tenant isolation and pay-per-running-cost economics.
- **Primary buyer:** independent and small-to-medium UK estate agencies operating across sales, lettings, and at least one specialist vertical (new homes, commercial, business transfer, care homes).
- **Primary user types:** agency staff (super admin, branch manager, sales agent, lettings agent, content editor, repairs manager); public visitors (buyers, tenants, sellers, landlords); registered customers (saved-search subscribers).

## 2. Canonical nouns — what each entity IS called

| Canonical noun | What it refers to | Used in code as |
|---|---|---|
| **Property** | Any listing, regardless of vertical | `property`, `properties` |
| **Listing type** | The vertical discriminator | `listing_type` (enum) |
| **Sale type** | For sale, or to rent | `sale_type` (enum) |
| **Market status** | Current sale/let state | `market_status` (enum) |
| **Branch** | A physical office of the agency | `branch`, `branches` |
| **Agent** | A staff member shown on the public Team page | `agent`, `agents` |
| **User** | Anyone who can authenticate (staff or customer) | `user`, `users` |
| **Vendor** | A property seller (the UK estate-agency term) | `vendor`, `vendors` |
| **Applicant** | Someone enquiring on or viewing a property | `applicant` |
| **Tenant** | A current or prospective renter | `tenant`, `tenants` |
| **Landlord** | The owner of a property being let | `landlord`, `landlords` |
| **Buyer** | A registered prospect with budget and criteria | `buyer`, `buyers` |
| **Enquiry** | Any inbound lead, regardless of source | `enquiry`, `enquiries` |
| **Lead** | Synonym for enquiry in conversation; code uses Enquiry | (UI label only) |
| **Viewing** | A scheduled visit by an applicant | `viewing_request` |
| **Valuation** | A market appraisal of a property | `valuation_request` |
| **Repair** or **Ticket** | A maintenance request raised by a tenant | `repair_request` |
| **Development** | A new-build estate containing multiple listings | `development` |
| **Area guide** | A managed area / location guide page | `area_guide` |
| **Tenant** *(of the platform)* | An agency that has signed up for the SaaS | `platform_tenant` to distinguish from rental tenant |

## 3. Canonical nouns — what each entity is NEVER called

| Forbidden alternative | Use instead |
|---|---|
| "Customer" (for buyer / vendor / applicant) | The specific role: Buyer, Vendor, Applicant. *Customer* is reserved for registered account holders only. |
| "House" (as the data-model name) | Property. *House* is one possible category. |
| "Client" (for any user) | The specific role. *Client* never appears in code. |
| "Lead" (in code / schema) | Enquiry. *Lead* is acceptable in UI labels. |
| "Inquiry" (US spelling) | Enquiry. UK English everywhere. |
| "Tenant" (when referring to a SaaS-platform tenant) | Use "platform tenant" or "agency tenant" to disambiguate from rental tenant. |
| "Renter" | Tenant. |
| "Realtor" / "Real estate" | Agent / Estate agency. UK industry language only. |
| "Listing" (as the entity name) | Property. *Listing* is acceptable as a UI label; the entity is *Property*. |
| "Letting" *(as a verb in UI copy when "renting" is clearer to the public)* | Use the standard UK industry term in agency-facing contexts; consider the public audience for tenant-facing copy. |
| "Home" / "house" used interchangeably with Property in admin/code | Property in admin and code; "home" or "house" only in marketing copy where contextually appropriate. |
| "Account" (for property record) | Property. *Account* refers only to a User's authentication record. |

## 4. UI vocabulary

Where the engine and the UI may use different terms, this table is the authority.

| Concept | UI label (public) | UI label (admin) | Code identifier |
|---|---|---|---|
| Property record | *Property* | *Property* | `property` |
| For-sale listing | *For sale* | *Sale* | `sale_type=sale` |
| To-let listing | *To rent* | *Let* | `sale_type=rent` |
| Sold subject to contract | *Sold STC* | *Sold STC* | `market_status=sold_stc` |
| Let agreed | *Let agreed* | *Let agreed* | `market_status=let_agreed` |
| Buyer enquiry form | *Contact agent* | *Buyer enquiry* | `lead_type=buyer_enquiry` |
| Viewing booking form | *Book a viewing* | *Viewing* | `viewing_request` |
| Seller valuation form | *Get a free valuation* | *Valuation* | `valuation_request` |
| Maintenance reporting form | *Report a repair* | *Repair / Ticket* | `repair_request` |

## 5. Tier model and feature packs

The platform is sold as a **modular product**. A tenant agency subscribes to a **plan tier** (Starter / Professional / Enterprise) which sets the base monthly fee and the included quotas. On top of the tier, the tenant enables zero or more **feature packs**, each of which switches on a discrete set of capabilities and may add to the monthly bill.

The technical mechanism is owned by EPIC-AD ("Feature packs and modular entitlement"). The catalogue and commercial inclusions below are the source of truth — EPIC-AD implements them faithfully.

### 5a. Pack catalogue

| Pack slug | Pack name | What it enables | Always on? |
|---|---|---|---|
| `core` | Core platform | Public marketing site, property catalogue, property detail, contact form, viewing requests, basic CRM, basic admin, customer accounts, SEO, security, audit, GDPR compliance — **plus the full Lettings experience** (tenant repair flow, contractor magic-link portal, tenant portal, landlord portal, deposit-protection display, gas safety / EICR / EPC compliance tracking) | Yes — every tenant gets this |
| `sales_plus` | Sales-plus | Vendor portal, comparables panel, offers entity, monthly vendor reports, vendor-side viewing-feedback display | No (add-on) |
| `new_homes` | New Homes | Developments entity, "From price" qualifier, "new homes only" filter, off-plan flag, new-homes vertical landing page | No (add-on) |
| `commercial` | Commercial | Commercial-specific property attributes (use class, business rates, VAT-payable, sqft critical), commercial enquiry form, commercial vertical landing page | No (add-on) |
| `business_transfer` | Business Transfer | Business-transfer attributes (turnover, P&L, confidentiality flag), business enquiry form, business-transfer vertical landing page | No (add-on) |
| `care_homes` | Care Homes | CQC rating, bed count, services offered, care-home vertical | No (add-on) |
| `portal_syndication` | Portal Syndication | Outbound Rightmove / Zoopla / OnTheMarket feeds | No (add-on) |
| `calculators` | Calculators | Stamp Duty + Mortgage calculators, embeddable on any CMS page | No (add-on) |
| `bulk_import` | Bulk Import | CSV / XML import + scheduled feed from existing CRMs (often a one-off engagement at signup) | No (add-on) |
| `feedback_reviews` | Feedback & Reviews | Cross-journey feedback collection, moderation queue, data-driven public reviews badge, agent league table | No (add-on) |
| `live_chat` | Live Chat | Embedded chat product integration | No (add-on) |
| `ai_assistant` | AI Assistant | AI rewrite of descriptions, AI alt-text suggestion, AI meta-title generation, AI lead-triage assistance | No (add-on) |

### 5b. Tier model

| Tier | Positioning | Plan code | Target buyer |
|---|---|---|---|
| **Starter** | Single-branch independents | `starter` | One-branch agency, sub-100 active listings |
| **Professional** | Growing multi-branch agencies | `professional` | Two-to-five-branch agency, sub-500 active listings |
| **Enterprise** | Large multi-branch and franchise networks | `enterprise` | More than five branches, more than 500 active listings, or specific compliance / data residency / SLA requirements |

### 5c. Pack inclusions per tier

Tier subscription **automatically enables** the packs marked ✓. Packs marked + are available as paid add-ons. Tier upgrades add the newly-included packs automatically.

| Pack | Starter | Professional | Enterprise |
|---|---|---|---|
| `core` | ✓ | ✓ | ✓ |
| `sales_plus` | + | ✓ | ✓ |
| `new_homes` | + | + | ✓ |
| `commercial` | + | + | ✓ |
| `business_transfer` | + | + | ✓ |
| `care_homes` | + | + | + |
| `portal_syndication` | + | ✓ | ✓ |
| `calculators` | ✓ | ✓ | ✓ |
| `bulk_import` | + | + | ✓ |
| `feedback_reviews` | + | ✓ | ✓ |
| `live_chat` | + | + | + |
| `ai_assistant` | + | + | + |

### 5d. Pack lifecycle (live-enable, support-disable)

- **Enabling a pack is self-serve.** A tenant operator can enable any available pack from the admin's Plan & packs screen. The change takes effect within 60 seconds. Billing fires for the next invoice (prorated for partial periods).
- **Disabling a pack requires a support conversation.** This is deliberate. Self-serve disable creates churn-on-enable risk and disincentivises packs from being made better; routing disablement through support gives us a chance to understand why and protects margin.
- **Trial periods** of 14 days are supported per pack at the platform operator's discretion. During a trial the tenant is not billed for the pack; an automatic reminder fires 3 days before the trial ends.
- **Disabling preserves data.** A tenant who disables a pack does not lose data — re-enabling restores everything. Data deletion only happens on tenant deprovisioning (master spec Section S.10).

### Tier inclusions and metering (cross-pack)

Each tier also includes a base quota for the metered metrics. Usage above the quota is charged as overage at the next invoice. These quotas apply regardless of which packs are enabled.

| Metric | Starter included | Professional included | Enterprise included |
|---|---|---|---|
| Active property listings | 100 | 500 | Unlimited |
| Media storage (GB) | 10 | 50 | 500 |
| Outbound email (per month) | 1,000 | 10,000 | 50,000 |
| Bandwidth egress (GB per month) | 50 | 250 | 2,000 |
| Dedicated database isolation | No (shared schema) | No (shared schema) | Yes (dedicated database) |
| Custom domain | Yes | Yes | Yes |
| Custom theme | Limited (colour + logo) | Full | Full |
| Two-factor enforcement for staff | Optional | Mandatory | Mandatory |
| Branch count | 1 | Up to 5 | Unlimited |
| Audit log retention | 12 months | 36 months | 7 years |
| SLA target | 99.5% | 99.5% | 99.9% (with credits) |
| Support response time | Best effort | Next business day | 4 working hours |

Concrete per-tier and per-pack pricing is not specified in this document; commercial terms are owned by the business and recorded outside this repo.

## 6. Compliance regime

The platform processes personal data of UK and EU residents and operates in the regulated UK estate-agency market. Compliance touches every feature.

### Regulatory framework

- **UK GDPR + Data Protection Act 2018.** Personal data of agency staff, applicants, tenants, landlords and vendors is in scope.
- **Property Ombudsman / Property Redress Scheme.** Every property listing must satisfy Material Information Parts A, B and C (Trading Standards / Property Ombudsman guidance from 2024 onwards).
- **Anti-Money Laundering Regulations 2017 (as amended).** Touches landlord onboarding, vendor onboarding and high-value transactions.
- **Right to Rent (Immigration Act 2014).** Applies to lettings.
- **Tenant Fees Act 2019.** Restricts fees that can be charged to tenants.
- **Deposit protection schemes (Housing Act 2004).** All let deposits must be lodged with a recognised scheme within 30 days.
- **Equality Act 2010.** Public-facing surfaces must meet accessibility obligations.
- **PECR (Privacy and Electronic Communications Regulations).** Cookie consent and marketing email rules.
- **Property Ombudsman Code of Practice (PO).** Industry-specific complaints handling.

### Universal compliance rules baked into the platform

These are tested via the CI lint and test guards described in `dev-briefs/sprint-01/_cross-cutting.md`.

1. **Every form that captures personal data must capture a GDPR consent affirmation** before submission, with the lawful basis declared in the privacy policy.
2. **Every public form must enforce a challenge-response or behavioural anti-spam check** with server-side verification.
3. **Every state-changing administrative action must write an audit-log entry** with actor, action, entity, entity identifier, structured diff, IP and user-agent.
4. **Every property listing must surface the Material Information document** (EPC, council tax band, tenure, etc.) on its public detail page when populated.
5. **Every emailed communication must respect the recipient's marketing-opt-in state**; transactional emails (confirmations, status updates) bypass the marketing flag but never carry marketing content.
6. **Every personal-data field must be subject to the configured retention period.** Records exceeding retention must be anonymised, not soft-deleted-only.
7. **Every public surface must meet WCAG 2.2 AA accessibility minimums.** Public CMS-driven content must offer authors guidance to keep contributed content compliant.
8. **Cookie consent must be granular** (necessary / analytics / marketing / preferences) and must gate the loading of non-essential scripts. Consent decisions must be logged.
9. **Custom-domain TLS certificates must auto-issue and auto-renew** — no manual operator step that could lapse.
10. **Sub-processors must be documented** in a published list reachable from the privacy policy, with advance notification of changes to tenant administrators.

## 7. Brand voice

The voice document below is a starting position. The agency tenant chooses their own voice via the CMS; this section governs only the *platform-operator-owned* surfaces (platform marketing site, billing emails, support comms, system notifications, admin help content).

### Voice principles

- **Direct.** Plain English. No filler. No marketing puffery.
- **Confident, not boastful.** State what the platform does, not how amazing it is.
- **Plural, not corporate.** "We" not "the platform" in conversational copy.
- **Honest about limits.** When something is out of scope or deferred, say so plainly.
- **Calm in crisis.** Incident and outage comms use measured language, acknowledge impact, give a clear next-update commitment.

### Vocabulary

- "Sign in", not "Log in".
- "Sign out", not "Log out".
- "Save changes", not "Update".
- "Submit", not "Send".
- Avoid: "leverage", "synergy", "robust", "best-in-class", "world-class", "cutting-edge", "delight", "wow".
- Prefer: "uses", "works with", "reliable", "complete", "modern", "useful".

### Capitalisation

- Sentence case for buttons, navigation, headings (not Title Case).
- Brand and product names retain their own casing.

## 8. Trust and disclosure markers (universal)

These adjacency rules are enforceable via CI lint (see `dev-briefs/sprint-01/_cross-cutting.md`).

- Every **price** on a public property surface must be adjacent to its **price qualifier** (e.g. "Offers in region of"), where one applies.
- Every **valuation widget** must declare that the result is **indicative only** and link to the qualified valuation pathway.
- Every **personal-data form** must have its **GDPR consent line** and **link to privacy policy** within the form's footprint.
- Every **rent figure** must show its **rent frequency** (PCM / PW / PA) immediately.
- Every **mortgage or fee calculator** must declare **"For guidance only — not financial advice"** adjacent to its result.
- Every **review widget** must surface the **review source** (Google / Trustpilot / etc.) and the **date range** the score covers.
- Every **AI-generated property description** (when this feature ships) must be flagged as such on the admin side, with the editor required to confirm.
- Every **email and SMS** must include an **unsubscribe instruction** where applicable and a **reply-handling address** that reaches a human.

## 9. Out-of-scope (explicit non-product)

The platform does not (and will not in the foreseeable roadmap):

- Originate mortgages or provide regulated mortgage advice.
- Provide regulated financial advice of any kind.
- Operate as an authorised firm under the Financial Conduct Authority.
- Conduct identity, AML or Right-to-Rent checks first-party — these defer to a specialist regulated service.
- Collect or hold tenant deposit money in client accounts — this defers to a specialist deposit-protection scheme or payment partner.
- Operate as a conveyancing service.
- Provide a regulated lettings agency service — the platform is a tooling product sold to regulated lettings agencies.

## 9a. Responsive design — universal expectation

Every customer-facing surface this platform produces is **responsive by default** at every viewport from 320 px to 2,560 px wide. This is a commercial expectation, not just a technical one. UK estate-agency customers browse on phones during a commute, on tablets in the office, and on desktops at home. A website that looks broken on any of these