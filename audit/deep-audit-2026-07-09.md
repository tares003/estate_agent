# Deep implementation audit — 2026-07-09

**Method.** A 9-dimension multi-agent audit of everything implemented to date, run as a two-phase workflow: one read-only auditor per dimension (tenant-isolation/RLS completeness, G4 audit-log coverage, authz + G5/G8 compliance, money/data integrity, public-surface leakage, spec fidelity for EPIC-F/X, EPIC-G/I/H, EPIC-T/U/AC/O/W, and test quality), followed by an adversarial verifier per dimension that attempted to refute every finding against the actual code. Only findings that survived refutation are recorded below (36 confirmed; 8 refuted and discarded). Each finding carries the auditor's evidence and a concrete recommendation.

**Headline.** Tenant isolation, G4 audit coverage and public-form compliance are strong (all 37 non-auth tenant tables FORCE-RLS'd with policies; ~38 mutating actions audited in-tx; all public personal-data forms carry G5 consent + G8 Turnstile — except sign-in). The serious problems cluster in **authorization of admin READ surfaces** and the **staff-session dev fallback**, plus a real **×100 money bug in saved-search digest matching** and several spec-fidelity gaps (confidential-listing redaction, publish preflight bypass, server-side pack enforcement, import row isolation).

**Severity tally:** 3 critical · 10 high · 12 medium · 11 low. (The two admin-read-gate criticals from different dimensions describe the same defect — one fix.)

**Fix batches:** F1 security-authz (criticals + staff-type + sign-in Turnstile + ungated helper) · F2 money/quota (digest ×100, quota predicate, matcher parity) · F3 confidential/address redaction · F4 publish-preflight + pack enforcement + import row isolation · F5 feedback single-use + auth-table FORCE RLS (schema) · F6 CI integration job. Mediums/lows without a batch are logged as future slices.

---

# Deep audit extraction — 9 dimensions, 36 confirmed findings

## Severity tally
- critical: 3
- high: 10
- medium: 12
- low: 11

## All confirmed findings ranked
- [CRITICAL] (authz-consent) admin-read-pages-ungated-pii-leak — apps/web/app/(app)/admin/enquiries/page.tsx
- [CRITICAL] (authz-consent) staff-dev-fallback-not-env-gated — apps/web/app/(app)/lib/staff-session.ts
- [CRITICAL] (fidelity-repairs-crm-admin) admin-read-surfaces-missing-rbac-gate — apps/web/app/(app)/admin/audit/page.tsx
- [HIGH] (authz-consent) staff-seam-missing-customer-type-check — apps/web/app/(app)/lib/staff-user.ts
- [HIGH] (money-data-integrity) saved-search-digest-price-off-by-100 — apps/workers/src/saved-search-match.ts
- [HIGH] (money-data-integrity) import-quota-active-predicate-diverges-from-publish — apps/web/app/(app)/lib/import-quota.ts
- [HIGH] (public-leakage) confidential-business-listing-leaks-name-address-geo — apps/web/app/(app)/lib/properties.ts
- [HIGH] (fidelity-property-import) publish-preflight-checklist-bypassed — apps/web/app/(app)/admin/properties/[id]/page.tsx
- [HIGH] (fidelity-property-import) vertical-pack-entitlement-not-enforced-server-side — apps/web/app/(app)/admin/properties/actions.ts
- [HIGH] (fidelity-property-import) import-duplicate-reference-aborts-whole-run — apps/web/app/(app)/admin/properties/import/actions.ts
- [HIGH] (fidelity-repairs-crm-admin) repair-emergency-internal-notifications-missing — apps/web/app/(app)/(public)/report-a-repair/actions.ts
- [HIGH] (fidelity-accounts-workers-content) feedback-token-not-single-use — apps/web/app/(app)/lib/feedback-access.ts
- [HIGH] (test-quality) ci-never-runs-integration-suites — .github/workflows/ci.yml
- [MEDIUM] (tenant-rls) auth-tables-rls-not-forced-isolation-by-convention — packages/db/migrations/raw/0012_better_auth_tables.sql
- [MEDIUM] (authz-consent) sign-in-missing-turnstile-g8 — apps/web/app/(app)/(public)/sign-in/actions.ts
- [MEDIUM] (authz-consent) feedback-token-not-single-use — apps/web/app/(app)/lib/feedback-access.ts
- [MEDIUM] (fidelity-property-import) hide-exact-address-not-implemented — apps/web/app/(app)/(public)/properties/[slug]/page.tsx
- [MEDIUM] (fidelity-property-import) property-soft-delete-action-missing — apps/web/app/(app)/admin/properties/[id]/actions.ts
- [MEDIUM] (fidelity-property-import) import-uses-property-write-not-property-import — apps/web/app/(app)/admin/properties/import/actions.ts
- [MEDIUM] (fidelity-property-import) import-upsert-mode-not-implemented — apps/web/app/(app)/admin/properties/import/actions.ts
- [MEDIUM] (fidelity-repairs-crm-admin) assignment-rules-never-applied — apps/web/app/(app)/(public)/contact/actions.ts
- [MEDIUM] (fidelity-repairs-crm-admin) repair-submission-produces-no-enquiry — apps/web/app/(app)/(public)/report-a-repair/actions.ts
- [MEDIUM] (fidelity-accounts-workers-content) saved-search-instant-frequency-never-delivered — apps/web/app/(app)/account/searches/SavedSearchRow.tsx
- [MEDIUM] (fidelity-accounts-workers-content) no-admin-scheduled-tasks-console — apps/web/app/(app)/admin
- [MEDIUM] (test-quality) saved-search-matcher-parity-drift — apps/workers/src/saved-search-match.test.ts
- [LOW] (tenant-rls) blog-mn-join-table-outside-rls-and-composite-fk — packages/db/migrations/raw/0019_blog_rls.sql
- [LOW] (g4-audit-coverage) saved-search-digest-advance-unaudited — apps/workers/src/saved-search-digest.ts
- [LOW] (authz-consent) exported-helper-becomes-ungated-server-action — apps/web/app/(app)/admin/properties/actions.ts
- [LOW] (fidelity-property-import) import-quota-counts-drafts-as-active — apps/web/app/(app)/admin/properties/import/actions.ts
- [LOW] (fidelity-repairs-crm-admin) audit-log-user-agent-never-captured — apps/web/app/(app)/admin/audit/AuditLogTable.tsx
- [LOW] (fidelity-repairs-crm-admin) repair-urgency-sla-not-configurable — apps/web/app/(app)/lib/repair-sla.ts
- [LOW] (fidelity-accounts-workers-content) stale-default-sdlt-bands — apps/web/app/(app)/lib/stamp-duty.ts
- [LOW] (fidelity-accounts-workers-content) digest-not-tenant-local-timezone — apps/workers/src/index.ts
- [LOW] (fidelity-accounts-workers-content) area-guide-slug-change-no-301 — apps/web/app/(app)/lib/area-guides.ts
- [LOW] (fidelity-accounts-workers-content) seo-jsonld-and-sitemap-gaps — apps/web/app/(app)/lib/seo.ts
- [LOW] (test-quality) import-insertpropertyrow-overmock-batch-gap — apps/web/app/(app)/admin/properties/import/actions.test.ts

---

## Tenant isolation + RLS completeness (tenant-rls)
confirmed: 2 | refuted: 0

### Auditor summary
Tenant-isolation/RLS completeness is strong. I enumerated all 42 Prisma models; 41 carry tenantId (PlatformTenant is the intentionally un-scoped registry). Cross-checking against raw migrations 0002-0022, all 37 non-auth tenant tables have ENABLE + FORCE ROW LEVEL SECURITY + a tenant_isolation policy on current_setting('app.current_tenant_id') (users/audit/consent/notification in 0002; core+CRM in 0003; satellites in 0005; status-history/files/categories/contractors in 0007-0011; feedback 0013; SDLT/mortgage/presets 0014/0015/0017; saved_properties 0016; assignment_rules 0018; blog 0019; area_guides 0020; seo-ops redirects/seo_metadata/import_logs 0021; saved_searches 0022). withTenant (packages/db/src/tenant-extension.ts) sets the GUC via SET LOCAL inside $transaction per request, and the base getDb() client is un-extended, so a forgotten withTenant fails closed on the FORCE'd tables rather than leaking. Workers (apps/workers) list the un-RLS'd registry and run every tenant inside withTenant; the geo raw $queryRawUnsafe runs inside withTenant; the workers' email_settings raw query (a Payload, non-Prisma table) filters explicitly by tenant_id. Middleware (proxy.ts/tenant-host.ts) resolves tenant from the hostname, strips the inbound tenant header, and fails closed in prod; feedback/contractor token flows anchor writes to the host-resolved tenant (feedback rejects mismatched-tenant tokens; contractor relies on RLS-scoped lookup + assignee check). The intentional RLS bypass (better-auth BYPASSRLS connection) is re-scoped in app code by auth-tenant-scope.ts, which injects tenantId into every op and throws when no tenant context is set (fail-closed); no code accesses the auth tables via the base client. Composite-tenant FKs (0006) close cross-tenant FK-reference holes for property/branch relations. Two evidenced, non-critical weaknesses remain: (1) the four better-auth tables are ENABLE-but-not-FORCE with no policy, so their isolation depends on an unenforced convention rather than the DB (medium, fragile pattern — FORCE+policy would not break the BYPASSRLS adapter); (2) the blog posts<->tags implicit join table sits outside both RLS and the 0006 composite-FK hardening (low, latent — no write path or read leak today). No critical cross-tenant breach, auth bypass, or public cross-tenant read was found.

### [MEDIUM] auth-tables-rls-not-forced-isolation-by-convention
File: packages/db/migrations/raw/0012_better_auth_tables.sql

sessions/accounts/verifications/two_factors get ENABLE ROW LEVEL SECURITY but no FORCE and no tenant_isolation policy, unlike every other tenant table (0002 confirms the app connects as the table OWNER, so ENABLE-without-FORCE means the owner bypasses RLS). The base getDb() client (apps/web/app/(app)/lib/db.ts -> createPrismaClient, no auth-scope extension) is that owner, so a single getDb().session.findMany()/account query would silently return every tenant's session/token rows. Cross-tenant isolation for these four tables therefore rests entirely on the unenforced convention that only the separate BYPASSRLS AUTH_DATABASE_URL client (auth-db.ts + auth-tenant-scope.ts) ever touches them; no CI/lint guard forbids base-client access (rules dir has only g04/g06, unrelated). The migration comment's stated reason for not forcing is inaccurate against the shipped design: auth-db.ts connects on a BYPASSRLS role that bypasses RLS irrespective of FORCE, so FORCE+policy would not break sign-in. No live leak today (tables dormant), so this is a latent hardening gap, but on high-sensitivity session/token data with an easy trap.

**Fix:** Add FORCE ROW LEVEL SECURITY plus a tenant_isolation policy (GUC-based, same shape as 0002) to sessions/accounts/two_factors so the owner base client is fail-closed; this is safe because the auth adapter runs on a BYPASSRLS role and is unaffected. At minimum, add a CI/lint guard forbidding base getDb() access to the Session/Account/Verification/TwoFactor Prisma models, and correct the 0012 comment to reflect that the auth adapter is BYPASSRLS (not merely owner-exempt).

### [LOW] blog-mn-join-table-outside-rls-and-composite-fk
File: packages/db/migrations/raw/0019_blog_rls.sql

The BlogPost<->BlogPostTag implicit join table _BlogPostToBlogPostTag carries no tenant_id, gets no RLS policy in 0019, and is not re-pointed to a composite (tenant_id, id) FK by 0006 (which touches only branches/properties references). Because Postgres validates FK existence with RLS bypassed and the join table has no RLS of its own, a tenant-scoped write that connects a post of tenant A to a tag id of tenant B would be structurally insertable -- the same D-012 class 0006 was created to close, but left uncovered for the blog join. Verified latent only: grep found no blogPost.create/update/upsert or tags:{connect} anywhere, blog.ts is read-only, and reads reach the join through RLS-isolated blog_posts/blog_post_tags, so there is no live data leak today -- only a hardening gap plus a weak cross-tenant tag-UUID existence oracle.

**Fix:** Before any blog write/connect path lands, extend the 0006 composite-FK hardening to the posts<->tags relation: replace Prisma's implicit m-n with an explicit join model carrying tenant_id and composite (tenant_id, blog_post_id)/(tenant_id, blog_post_tag_id) FKs under FORCE RLS, or enforce same-tenant tag membership in the write path. Update the 0019 comment to note its 'reachable only through isolated rows' rationale covers reads but not FK-checked connects.

---

## G4 audit-log coverage of every state change (g4-audit-coverage)
confirmed: 1 | refuted: 2

### Auditor summary
Swept the full G4 surface: the audit() helper, all ~38 'use server' mutating actions, the 4 worker jobs, Payload collections, and confirmed no unaudited Prisma writes in lib/ or API routes. audit() (packages/db/src/audit.ts) is sound: it writes tenant-scoped rows enforced by the audit_logs RLS WITH CHECK (0002_rls_policies.sql), and it awaits create() and propagates errors — it cannot throw silently, so an in-tx audit failure rolls back the mutation. Every admin and public form action (property CRUD, publish/preflight, market-status, enquiry status/note/conversion, feedback moderation/edit, repair triage/assign/link/categories/contractors, SEO/redirects/mortgage/SDLT/presets settings, CSV import incl. per-row failures, account profile/searches/saved, and all public enquiry/valuation/viewing/contact/repair/register/feedback/cookie-consent/contractor flows) correctly pairs its Prisma mutation with an audit(tx,...) call inside the SAME withTenant callback, with sensible from/to diffs; create-events omit diff, which is acceptable (none misleading). The four workers set the tenant GUC via withTenant per tenant and audit in the same runner tx as their finalize/mark mutation. Three gaps found, none critical: (1) the four better-auth actions (register/sign-in/forgot/reset) audit in a SEPARATE transaction from the state change performed in the auth seam — a genuine dual-write (medium); (2) the saved-search digest 'advanced' (no-match) branch advances lastAlertSentAt with no audit row (low); (3) the email/SMS outbox claim transition queued->processing is unaudited (low, lock-by-design). Also noted out-of-band: Payload CMS content edits (Pages/Menus/Media) have no hooks and are not audited via audit() — they rely on Payload's own versioning, so they sit outside the audit_logs trail; flag for a product decision rather than as a code defect.

### [LOW] saved-search-digest-advance-unaudited
File: apps/workers/src/saved-search-digest.ts

In processSavedSearchDigest, the no-match branch (lines 184-190) advances the persisted savedSearch.lastAlertSentAt watermark via tx.savedSearch.update({lastAlertSentAt: now}) with NO audit() call, then returns 'advanced'. The emitted branch (lines 199-216) performs the same savedSearch.update alongside audit({action:'saved_search.alerted'}), proving this mutation on the audited saved_search entity is auditable. So a no-match run permanently mutates persisted state with no audit row. Unlike the notification-claim transition, this is not a transient lock and is not documented or annotated as a deliberate non-audit. It is outside the G4 ESLint guard's scope because the guard only inspects 'use server' handlers and workers carry no such directive, so nothing flags it.

**Fix:** Either emit a cheap audit row on the no-match advance (e.g. action 'saved_search.digest_advanced', entity 'saved_search', diff {matches:0}) to keep coverage symmetric with the emitted branch, or add an explicit `// audit-exempt: <reason>` comment documenting that advancing the FR-U-4 idempotency watermark on a no-match run is intentionally not audited.

---

## AuthZ fail-closed + G5 consent + G8 Turnstile (authz-consent)
confirmed: 6 | refuted: 0

### Auditor summary
Swept the authorization + public-form-compliance surface: the staff/customer session seams (staff-session.ts, customer-session.ts + resolve/user helpers), the RBAC catalogue (packs/auth roles.ts/access.ts), proxy.ts and all four layout.tsx (route-level gating), every /admin server action (~34 exported actions across enquiries, conversion, notes, properties, images, import/preview, publish, market-status, repairs assign/status/link/categories/contractors, feedback, settings stamp-duty/mortgage/redirects/seo, assignment-rules), all 22 /admin read pages, every customer account action (saved, searches, profile), all public personal-data forms (enquiry, viewing, valuation, contact, report-a-repair, register, forgot/reset-password, feedback) with their Zod schemas, and the two magic-link token surfaces (contractor, feedback) with turnstile.ts.\n\nThe public-form side is solid: all personal-data schemas require gdpr_consent via z.literal(true) (G5) and every public write verifies Turnstile before persisting (G8), with consent + audit recorded in one tenant tx; customer actions fail closed on getCustomerSession and enforce row ownership by userId; contractor/feedback tokens are HMAC-signed, expiring, constant-time verified and tenant-checked. Every /admin *write* action calls requireStaffPermission first, fail-closed (try/catch -> deny), with sensible permission strings.\n\nThe authorization side has serious gaps. Two critical issues: (1) most /admin READ pages (enquiries, contacts, audit, users, and others) render tenant PII/audit/user data with no RBAC gate at all, and nothing at the proxy or layout level gates either — an unauthenticated GET leaks the data; (2) the staff dev-login fallback in staff-session.ts returns super_admin unconditionally with no NODE_ENV gate, so unauthenticated requests in production resolve to super_admin and pass every write gate. High: the staff seam never checks user.type, so a signed-in customer maps to a read_only_auditor staff session. Medium: the sign-in public write lacks Turnstile (unlike register/forgot-password), and the 'one-time' feedback token is replayable until expiry (no single-use enforcement). Low: insertPropertyRow is an ungated exported Server Action (not practically exploitable). The note about the in-progress property-search.ts advanced-filter edit was respected and not reported.

### [CRITICAL] admin-read-pages-ungated-pii-leak
File: apps/web/app/(app)/admin/enquiries/page.tsx

The /admin read pages (enquiries, contacts, audit, users) render sensitive tenant data with no authorization gate: each only calls getCurrentTenantId()+withTenant()+list…() then renders. Verified that proxy.ts, the root layout, the (app) layout, the (public) layout and admin/layout.tsx (getStaffActor is used only for a display label) all perform zero auth, and only 9 of 22 admin pages call requireStaffPermission. An unauthenticated GET on a tenant host leaks names/emails/phones/enquiry messages, the full audit trail (actor+IP+diffs) and the staff directory.

**Fix:** Enforce auth fail-closed for the whole /admin surface — e.g. call requireStaffPermission (enquiry.read / contact.read / audit.read / user.read respectively) at the top of each read page, or gate the entire segment in a shared admin server layout/middleware so no admin route renders without a valid staff session.

### [CRITICAL] staff-dev-fallback-not-env-gated
File: apps/web/app/(app)/lib/staff-session.ts

getStaffSession's step-3 DEV_FALLBACK (lines 31-35) returns role 'super_admin' with no NODE_ENV/secret guard (line 71 `return DEV_FALLBACK`). With BETTER_AUTH_SECRET set in production, an unauthenticated request yields getSession→null → staffAuthLookup→null → step-2 skipped (DEV_STAFF_USER_ID unset) → super_admin, so every requireStaffPermission on a gated page/Server Action (e.g. createProperty/updateProperty property.write, settings *.manage) passes as super_admin. The header's claim of 'an admin gate elsewhere' is false — proxy.ts and all layouts perform no auth. Contrast proxy.ts:27 (env-gated fallback) and the customer seam (fails closed to null).

**Fix:** Fail closed instead of granting super_admin: only reach DEV_FALLBACK when NODE_ENV !== 'production' (mirroring proxy.ts:27), and in production throw/return an unauthenticated session so requireStaffPermission denies when no verified staff cookie or configured dev user is present.

### [HIGH] staff-seam-missing-customer-type-check
File: apps/web/app/(app)/lib/staff-user.ts

The staff seam never checks user.type. loadStaffSession (line 44) does user.findFirst({ where: { id: userId } }) with no type filter, staffAuthLookup (staff-session-resolve.ts) matches only tenant, and staffSessionFromUser (line 35) maps a non-staff role to 'read_only_auditor', which grants every '.read' permission (roles.ts READ_ONLY). Customers are created type:'customer' with no staff role (customer-register.ts), so a signed-in customer's Better Auth cookie resolves to a staff read_only_auditor session and passes any RBAC read gate (e.g. /admin/feedback's requireStaffPermission('feedback.read')). The customer seam correctly rejects non-customers (customer-user.ts:39,56); the staff seam is asymmetric.

**Fix:** Mirror the customer seam: restrict the staff lookup to staff rows (add type filter to loadStaffSession's where and/or reject a non-staff type in staffSessionFromUser, returning null) so a customer identity can never resolve to any staff role.

### [MEDIUM] sign-in-missing-turnstile-g8
File: apps/web/app/(app)/(public)/sign-in/actions.ts

submitSignIn parses email+password, calls signInCustomer (mints a session cookie) and writes a customer.signed_in audit row, but never reads cf-turnstile-response or calls verifyTurnstile. It is the only one of the nine public form actions that omits the challenge — register, forgot-password, feedback, contact, valuation, viewing, property-enquiry and report-a-repair all verify Turnstile before their side effects — despite CLAUDE.md (G5+G8) requiring server-side verification 'on every form submission'. This leaves the credential endpoint open to unthrottled credential-stuffing/brute-force and audit-row spam.

**Fix:** Add the Turnstile widget to SignInForm and verify the token server-side (verifyTurnstile) at the top of submitSignIn, before signInCustomer and the audit write, returning the generic failure on a missing/failed challenge — matching the sibling public auth actions.

### [MEDIUM] feedback-token-not-single-use
File: apps/web/app/(app)/lib/feedback-access.ts

verifyFeedbackToken (lines 69-105) validates only the HMAC signature and expiry; nothing records consumption. submitFeedback re-verifies the token on every call and creates a new feedback row each time with no dedupe/consumed-token tracking, so a still-valid link can be replayed repeatedly until expiry. Dev-brief FR-AC-2 mandates a 'one-time-token URL' and the file header calls it a 'one-time feedback-request token', yet single-use is unenforced (unlike FR-N-5 reset tokens, which are deleted on use). Replay skews the live FR-AC-6 public aggregate (computed over all feedback) and floods the FR-AC-5 moderation queue.

**Fix:** Enforce single use: record token consumption (e.g. a used-token/nonce row or a per-trigger unique constraint keyed on the token/trigger record) inside the same tenant transaction as the feedback insert, and reject a token that has already been redeemed.

### [LOW] exported-helper-becomes-ungated-server-action
File: apps/web/app/(app)/admin/properties/actions.ts

The module begins with 'use server' (line 1), so the exported insertPropertyRow (line 235) is registered by Next as a network-callable Server Action, yet it performs tx.property.create + audit with no requireStaffPermission — the property.write gate exists only in its callers createProperty (317) and updateProperty (376). Verified not practically exploitable because its first argument is a live Prisma transaction handle a remote caller cannot supply, so it is a benign-by-accident ungated action surface (defense-in-depth only).

**Fix:** Move insertPropertyRow (and similar internal helpers) into a non-'use server' module imported by the actions, so it is never exported as an action endpoint; keep only the gated createProperty/updateProperty as Server Actions.

---

## Money units, quota math, slugs, dates (money-data-integrity)
confirmed: 2 | refuted: 1

### Auditor summary
Swept the full data-integrity surface for the money/quota/slug/date dimension. MONEY: traced every price path — catalogue cards (formatPrice pence÷100), catalogue + radius filters (toOptions pounds×100→pence), detail page + JSON-LD (priceValue=price/100 pounds), admin table (formatPrice), admin create/edit forms (prefill price/100, write ×100), both update actions (×100), CSV import (pounds→×100 in coreData) and import preview sample (raw validated pounds), and the digest email (formatPrice pence). All are consistent EXCEPT apps/workers/src/saved-search-match.ts, which compares pence property prices to pounds filter bounds with no ×100 — a real off-by-100 that corrupts daily/weekly saved-search alerts (HIGH), and whose unit test masks it by using pence-valued filters. QUOTA (FR-X-10): the import check is fail-closed (resolvePlanTier defaults to starter), computed as existingActive+incoming and enforced before any insert inside the tenant tx; a mapped import cannot bypass it and upsert is unimplemented. BUT activeListingWhere() counts publicationStatus='published' while the rest of the app (and the publish actions, which set only publishedAt) treats publishedAt!=null as live — so the cap is measured against a column the publish flow never sets and is bypassable via publish or import-then-publish (HIGH). SLUGS: per-tenant uniqueness is enforced at create, import (with an in-run taken-set) and update-rename, backed by @@unique([tenantId, slug]); no gap found. DATES: publishedAt is timestamptz (UTC); digest matching uses getTime() (TZ-agnostic) with strict > for idempotency; cron runs server-time but that is a documented FR-U-9 deferral, not a data bug. One LOW: per-vertical money columns are pounds while price is pence, contradicting the schema comment (latent x100 hazard, no current miscalc).

### [HIGH] saved-search-digest-price-off-by-100
File: apps/workers/src/saved-search-match.ts

propertyMatchesSearch (lines 83-88) compares property.price against filters.priceMin/priceMax with no unit conversion, but the two are in different units. property.price is the raw DB pence column (listCandidateProperties in saved-search-digest.ts does a plain property.findMany; schema.prisma price Int is pence). The saved filters are the raw PropertySearch shape (savedSearchCreateSchema.filters = propertySearchSchema), whose priceMin/priceMax are POUNDS (property-search.ts optionalPounds: 'The route multiplies by 100 to the pence'). The catalogue only applies *100 in page.tsx toOptions for the live query; the saved copy (JSON.stringify(search)) stays in pounds, and the digest worker passes it verbatim to findNewMatches. Result: daily/weekly digest alerts match on a 100x-wrong band — a priceMax filter excludes virtually every real listing, a priceMin filter over-matches. saved-search-match.test.ts (lines 118-124) hides this by feeding pence-scale numbers (25_000_000) as the pounds filter.

**Fix:** Convert the filter bounds to pence before comparing (multiply filters.priceMin/priceMax by 100, mirroring page.tsx toOptions and buildWhere), or normalise the saved-search filters to pence at write time. Update the test to use realistic pounds bounds (e.g. priceMax: 300000) against a pence property price so the unit mismatch is caught.

### [HIGH] import-quota-active-predicate-diverges-from-publish
File: apps/web/app/(app)/lib/import-quota.ts

activeListingWhere() (line 35) counts a tenant's active listings by { publicationStatus: 'published', deletedAt: null }, but the platform's live/public gate everywhere else is publishedAt IS NOT NULL (lib/properties.ts buildWhere and saved-search-match.ts isPublic both key off publishedAt != null and never read publicationStatus). Both publish actions write only publishedAt and never set publicationStatus: publish-actions.ts setPropertyPublished (data: { publishedAt }) and publish-preflight-actions.ts publishWithPreflight (data: { publishedAt: new Date() }); publicationStatus defaults to 'draft' (schema.prisma line 480). So a listing published via the PublishControl is publicly live yet still publicationStatus='draft', so existingActive never counts it. A tenant can import to the cap (all rows draft, existingActive stays 0), publish them (they go live, count unchanged) and repeat, exceeding the plan's active-listing cap (starter=100) without bound.

**Fix:** Count active listings by the same predicate that makes a listing live/public — publishedAt: { not: null }, deletedAt: null — so the quota measures actual live listings, or make the publish actions set publicationStatus='published'/'draft' in lockstep with publishedAt. Update quota-enforcement.test.ts / import-quota.test.ts to assert the corrected predicate.

---

## Public-surface data leakage (public-leakage)
confirmed: 1 | refuted: 1

### Auditor summary
Swept every public read surface under app/(app)/(public) and the lib/ read models. CLEAN: catalogue (properties.ts / page.tsx) filters publishedAt not null + deletedAt null on both the Prisma and PostGIS-radius paths and on the sitemap/area-property feeds; blog.ts, area-guides.ts and cms.ts filter status=published (BlogPost/AreaGuide/Page have no soft-delete column, so no deletedAt gap); testimonials (published-feedback.ts) filters status=published AND publishAsTestimonial and projects only rating/comment/date — respondentRef/agentActor/triggerType/notes never leave the data layer; the feedback token page and contractor portal are token-gated (HMAC key+expiry bound, constant-time verify, parse-after-verify), noindex where appropriate, and the contractor view curates fields (no reporter contact / internal notes); the storage object route requires a valid HMAC token whose signature binds the key, rejecting tampered/expired tokens; robots disallows /admin /account /api/ /preview/; JSON-LD builders embed only listing/blog/area fields. TWO findings: (1) HIGH — the isConfidential flag for business-transfer listings never masks the business name, exact address, postcode or geo on the public detail page, catalogue card, or JSON-LD, contradicting the spec that says the flag hides name+address; the test claiming to verify this asserts nothing about it. (2) MEDIUM — the public reviews badge aggregates over ALL feedback with no status filter, so pending and admin-rejected feedback influence the public average and count. Per the task note, I did not report on the in-progress advanced-filter edit in packages/validators.

### [HIGH] confidential-business-listing-leaks-name-address-geo
File: apps/web/app/(app)/lib/properties.ts

The business-transfer `isConfidential` flag never suppresses the business's name, exact address, postcode, or geo coordinates on the public surface, contradicting spec line 527 ('a confidential flag that hides the business's name and exact address from the public listing'). In properties.ts, toCardProps builds title=`row.title ?? row.displayAddress` and address=`${displayAddress}, ${postcode}` with no confidential check (lines 236-237), getPropertyBySlug returns full displayAddress/postcode/latitude/longitude (lines 396-400), and toVerticalFacts only passes isConfidential through (line 422). The detail page [slug]/page.tsx renders {address} and {title} unconditionally (lines 248-249) and feeds the full property into propertyListingJsonLd, which emits name/streetAddress/postalCode and a geo block (lat/long) with no redaction (seo.ts lines 63-83). The catalogue grid uses the same toCardProps, so confidential name+address also render there. No public read/render path anywhere reads isConfidential to redact. The test vertical-facts.test.tsx:138 titled 'hides the name/address when confidential' only asserts the financial facts render (lines 149-151) and never asserts the name/address are hidden, so the gap is untested.

**Fix:** In the public read/render path, when vertical.isConfidential is true for a business_transfer listing, replace the business name and exact address/postcode with a non-identifying placeholder (e.g. town/region only) and omit displayAddress, postcode, latitude, and longitude from both the rendered header ([slug]/page.tsx) and the propertyListingJsonLd/geo output (seo.ts). Apply the same redaction in toCardProps so the catalogue card does not leak. Add an assertion to the confidential test that the business name and address are NOT in the document.

---

## Spec fidelity: EPIC-F catalogue/property + EPIC-X import (fidelity-property-import)
confirmed: 8 | refuted: 1

### Auditor summary
I audited EPIC-F (property catalogue/detail) and EPIC-X (bulk import) by reading the Prisma Property model, the admin write/publish/image server actions, the pack-entitlement helpers, the public property detail page, the import core/preview/quota code, the CRM mapping presets, the image-processing worker, and the role catalogue.

Highest-impact findings: (1) FR-F-8 is not enforced in the live flow — the wired PublishControl calls setPropertyPublished, which sets publishedAt with no checklist; the checklist-enforcing publishWithPreflight/PublishPreflight is orphaned. (2) G12 pack entitlement for the per-vertical listing types is only render-gated; createProperty/updateProperty (and the import path) never check isPackEnabled, so a crafted POST authors pack-gated verticals for free. (3) The import loop has no per-row DB-error isolation, so a duplicate `reference` (unique constraint) aborts the whole run — breaking FR-X-5 and making re-imports crash.

What is correctly implemented: FR-F-2 single discriminated table; FR-F-4/F-11 deterministic slug generation + collision disambiguation read in-tx; FR-F-5/FR-O-12 301 redirect on slug change (audited in the same tx); FR-F-6 presigned direct upload (server never proxies bytes); FR-F-7 EXIF-strip + thumb/large variants via a scheduled outbox worker; FR-X-3 preset+custom mappings (Reapit/Alto/Jupix/Vebra/Rex) with detection; FR-X-6 import_logs counts; FR-X-9 one audit per run + one per failed row; FR-X-10 quota surfaced in preview and enforced before insert. Price units (pence→pounds) are consistent across card and JSON-LD.

Coverage: F-1 implemented (schema; write form covers a core subset only); F-2 implemented; F-3 partial (isolation in admin write only, skipped on import; pack gating render-only); F-4 implemented; F-5 implemented; F-6 implemented; F-7 implemented; F-8 NOT enforced (bypassed); F-9 NOT implemented; F-10 partial (reads exclude deletedAt but no soft-delete action); F-11 implemented. X-1 partial (property.write not property.import; CSV only); X-2 partial (no import-mode choice); X-3 implemented; X-4 not implemented; X-5 partial (validation isolation only, DB-constraint failures abort run); X-6 implemented; X-7 not implemented; X-8 not implemented; X-9 implemented; X-10 implemented (over-counts drafts); X-11 not implemented (import handles no images).

### [HIGH] publish-preflight-checklist-bypassed
File: apps/web/app/(app)/admin/properties/[id]/page.tsx

The detail page (page.tsx:24,87) wires <PublishControl>, whose action setPropertyPublished (publish-actions.ts:64-67) just sets publishedAt with no checklist evaluation, so the FR-F-8 §H.5 Tab 9 pre-flight checklist is bypassed. The checklist-enforcing publishWithPreflight and <PublishPreflight> exist but are referenced only in their own files/tests and rendered nowhere — so listings with no EPC, material info, images or description can be published.

**Fix:** Render <PublishPreflight> (backed by publishWithPreflight + loadPublishPreflightInput) on the detail page in place of the checklist-less <PublishControl>, or route the publish path through evaluatePublishPreflight so publishing is blocked unless the checklist is all-green or a typed override is supplied.

### [HIGH] vertical-pack-entitlement-not-enforced-server-side
File: apps/web/app/(app)/admin/properties/actions.ts

createProperty (actions.ts:276-342) and updateProperty (348-470) enforce only validatePropertyVerticalFields (field isolation) and requireStaffPermission('property.write'); neither checks pack entitlement. isPackEnabled/getEnabledVerticals are used solely to render-gate the admin form (new/page.tsx, [id]/edit/page.tsx). A crafted POST can therefore author commercial/new_home/business_transfer/care_home listings and their extension fields without the tenant owning the pack, contradicting property-write.ts:26-27 which claims the calling Server Action enforces the G12 pack gate.

**Fix:** In the create/update actions, resolve the effective listingType and fail closed when its pack is not enabled for the tenant (reuse isPackEnabled/getEnabledVerticals server-side), mirroring the render gate.

### [HIGH] import-duplicate-reference-aborts-whole-run
File: apps/web/app/(app)/admin/properties/import/actions.ts

The create loop (actions.ts:156-164) calls insertPropertyRow with no try/catch; insertPropertyRow (../actions.ts:247) inserts reference:input.reference and Property has @@unique([tenantId, reference]) (schema.prisma:606). A duplicate reference (an existing row, or two identical references in one file) throws P2002 inside withTenant, rolling back the whole transaction and propagating an unhandled error — the entire import aborts with nothing created, violating FR-X-5 row isolation (only validation errors are isolated, not DB-constraint failures). Slugs are de-duped via `taken`; references are not.

**Fix:** Wrap each insertPropertyRow in a per-row try/catch (or pre-check references) so a duplicate/constraint failure is recorded as a failed/skipped row and the run continues instead of aborting the whole import.

### [MEDIUM] hide-exact-address-not-implemented
File: apps/web/app/(app)/(public)/properties/[slug]/page.tsx

The hideExactAddress column exists (schema.prisma:535) but has no consumer: getPropertyBySlug (lib/properties.ts:382) never reads it, toCardProps builds address as `${displayAddress}, ${postcode}` unconditionally (lib/properties.ts:237) and page.tsx:248 renders it in full, and propertyListingJsonLd emits the exact PostalAddress plus raw GeoCoordinates (lib/seo.ts:65-83). The required postcode-prefix-only render / offset map marker is absent (no PropertyMap component).

**Fix:** Select hideExactAddress in getPropertyBySlug and, when set, render only the postcode prefix/town, omit or coarsen the JSON-LD geo + postalCode, and use an offset marker instead of exact coordinates.

### [MEDIUM] property-soft-delete-action-missing
File: apps/web/app/(app)/admin/properties/[id]/actions.ts

Reads consistently filter Property.deletedAt: null (lib/properties.ts:172,387,446; admin-properties.ts:57,106; publish/market-status/image actions), but no Server Action ever WRITES Property.deletedAt — the only delete action is deletePropertyImage (image-actions.ts:261,294), a hard delete of a PropertyImage. The FR-F-10 soft-delete lifecycle the read side assumes is therefore unusable: a property can never be soft-deleted.

**Fix:** Add an audited, RBAC-gated Server Action that sets Property.deletedAt (fail-closed, in a tenant transaction with an audit row), completing the soft-delete lifecycle.

### [MEDIUM] import-uses-property-write-not-property-import
File: apps/web/app/(app)/admin/properties/import/actions.ts

FR-X-1 requires a property.import permission and CSV/XML upload, but importPropertiesFromCsv (actions.ts:96) and previewPropertyImport (preview-action.ts:129) gate on property.write, and property.import is absent from the role catalogue (roles.ts:22-67 defines only property.read/write/publish). The core parses CSV only (csv-import-core.ts:1 uses csv-parse); there is no XML path. The action comment (actions.ts:21-22) acknowledges the gap.

**Fix:** Add property.import to the permission catalogue and grant it to the appropriate roles, gate the import/preview actions on it, and add the XML upload/parse path FR-X-1 requires.

### [MEDIUM] import-upsert-mode-not-implemented
File: apps/web/app/(app)/admin/properties/import/actions.ts

Only create-only import exists: actions.ts hard-codes recordsUpdated:0 (line 182) and skipped:0 (line 171) with a comment deferring upsert; there is no external_id/reference matching (FR-X-4) and the preview (preview-action.ts) exposes no dry-run/create-only/upsert mode selector (FR-X-2). The acceptance criterion 're-running the same import in upsert mode does not create duplicates' cannot be met.

**Fix:** Implement an upsert mode that matches incoming rows on reference/external_id and updates existing rows (counting updated/skipped), and surface the mode choice in the preview.

### [LOW] import-quota-counts-drafts-as-active
File: apps/web/app/(app)/admin/properties/import/actions.ts

The quota check compares existingActive + incoming against the cap where incoming = parseResult.valid.length (actions.ts:125,138) — every valid row — but imported rows default to publicationStatus 'draft' (schema.prisma:480; insertPropertyRow sets it only if the CSV provides it), while activeListingWhere() counts only published rows (import-quota.ts:35). A legitimate draft import can thus be wrongly rejected as 'quota exceeded'. The check is conservative (never under-counts) but over-strict.

**Fix:** Count only rows that would be published (publicationStatus === 'published') as incoming active listings against the cap, so draft imports are not spuriously blocked.

---

## Spec fidelity: EPIC-G repairs + EPIC-I CRM + EPIC-H admin (fidelity-repairs-crm-admin)
confirmed: 6 | refuted: 0

### Auditor summary
Swept EPIC-G (repair flow), EPIC-I (CRM/enquiries) and EPIC-H (tenant admin) against dev-briefs/v1 and master spec §G/§H/§I. Read the repair intake action, contractor magic-link portal + token (contractor-access.ts), repair status machine (repair-status.ts), SLA banding (repair-sla.ts), admin repair triage/assign actions, enquiry status/conversion/note actions, assignment-rule schema+evaluator+editor, admin dashboard/audit/users/reports/enquiries/repairs pages, admin layout, proxy/middleware, notification + SMS dispatchers/templates, the Prisma schema and the @estate/auth RBAC catalogue.

What is solid: repair status machine and off-path states (§G.5/G.6) match spec; contractor magic-link is HMAC-signed with constant-time verify, a separate secret, expiry, current-assignee binding and RLS tenant scoping, and the contractor page is curated to exclude reporter contact + internal notes; presigned direct upload (FR-G-2) with structural prefix authorisation; enquiry status machine (§I.3), conversion→contact (FR-I-6), threaded internal notes (FR-I-5) and audit coverage (FR-I-7, G4) on every write action are correct; write actions consistently gate via requireStaffPermission and audit in-tenant.

Key gaps (findings above): (critical) admin READ surfaces — audit viewer, users, enquiries queue, contacts, reports, repairs inbox, dashboard — enforce no RBAC/session gate and neither layout nor middleware gates /admin, so reads are not access-controlled (RLS still isolates tenants); (high) repair submissions never notify staff/branch/on-call — only tenant email + tenant SMS are queued, so FR-G-3 internal + emergency team-messaging channels are absent; (medium) assignment rules are never applied at enquiry creation and there is no assigned-agent column; (medium) the repair form writes no enquiry row, so repairs are invisible to the unified CRM queue/reports; (low) audit rows never capture user-agent; (low) urgency/SLA targets are hardcoded, not admin-configurable.

Coverage table (FR -> status):
EPIC-G: G-1 partial (no access_permission field captured); G-2 implemented; G-3 PARTIAL (internal + emergency team-messaging notifications missing); G-4 implemented (RepairCategory + categories admin); G-5 missing (fixed enum, hardcoded SLA); G-6 implemented; G-7 implemented; G-8 implemented; G-9 partial (bands correct, thresholds hardcoded); G-10 missing (no bulk emergency dispatch); G-11 missing (no recurring maintenance); G-12 missing (no RepairMessage model / threaded messaging).
EPIC-I: I-1 partial (repair path writes no enquiry; only 8 of 12 lead types, seller_valuation renamed valuation_request; career/developer/commercial/business absent); I-2 implemented; I-3 partial (editor+tester+evaluator, not applied/stored); I-4 missing (no priority field, no SLA config); I-5 implemented; I-6 implemented; I-7 implemented; I-8 missing (no bulk operations); I-9 missing (no SavedView model); I-10 partial (pipeline + by-source + agent ratings, date-range only — no branch/agent filters, not the full report suite).
EPIC-H: H-1 partial (static KPIs; no alerts panel/activity feed/personalisation); H-2 partial; H-3 partial (queue exists; repair enquiries absent; only note composer); H-4 implemented-but-inert (rules not applied); H-5 missing (calendar); H-6 partial (SLA yes, bulk assignment no); H-7 partial (contacts table; dedup/merge/compliance-expiry not found); H-8..H-14 missing (page builder, theme editor, email/SMS template editors, SMTP config, notification matrix, form builder, automation, integrations); H-15 partial (users list only; no role matrix/custom roles/test-as-role; no read gate); H-16 missing (no settings hierarchy; only isolated settings pages); H-17 partial (no user-agent; no RBAC gate); H-18 partial; H-19/H-20/H-21 missing (scheduled-tasks console, maintenance mode/flags, command palette). Note: many H items are expected-incomplete for a mid-build epic; the critical/high findings are the ones that are wrong or unsafe rather than merely unbuilt.

### [CRITICAL] admin-read-surfaces-missing-rbac-gate
File: apps/web/app/(app)/admin/audit/page.tsx

The admin read surfaces (audit/page.tsx, users/page.tsx, enquiries/page.tsx, contacts/page.tsx, reports/page.tsx, repairs/page.tsx, enquiries/[id]/page.tsx and the dashboard) call only getCurrentTenantId()+withTenant with no requireStaffPermission or session check. Verified the entire layout chain is ungated: proxy.ts does tenant resolution/redirects/security-headers only, (app)/layout.tsx is the bare HTML shell, and admin/layout.tsx calls getStaffActor() purely for display. By contrast feedback/page.tsx gates on requireStaffPermission('feedback.read') and every write action gates. Result: any request resolving to a tenant host — including unauthenticated — can read the audit log, user directory, contacts and enquiries (PII), and within a tenant, roles lacking audit.read/user.read/etc (e.g. sales_agent lacks audit.read per roles.ts) are not stopped. RLS still isolates tenants, so this is within-tenant/unauthenticated exposure, not cross-tenant.

**Fix:** Add a fail-closed gate to each admin read page (or centrally in admin/layout.tsx) calling requireStaffPermission with the surface's *.read permission (audit.read, user.read, enquiry.read, contact.read, repair_request.read, plus a base staff-session check), mirroring the pattern already used in feedback/page.tsx.

### [HIGH] repair-emergency-internal-notifications-missing
File: apps/web/app/(app)/(public)/report-a-repair/actions.ts

FR-G-3 and master spec lines 106/913/1977 require each submission to notify the property manager + branch repairs queue and, on emergency, additionally alert the on-call manager via SMS + team-messaging (Slack/Teams). The action (lines ~181-203) queues only 'repair_request.received' email to the reporter and, on emergency, 'repair_request.emergency' SMS to the reporter's own phone. No staff/branch/on-call recipient is ever queued; the workers dispatch to the recipient baked into each notification_log row (no fan-out), and no on-call-rota or notification-rules mechanism exists (no on_call_rota code, no admin/settings/notifications). Staff are therefore never alerted to any repair, defeating the 'emergency ticket triggers all configured emergency channels' acceptance criterion and the 'branch manager paged' user story.

**Fix:** Queue the configured internal staff notifications (property-manager/branch-repairs email) on every submission and, for emergency urgency, additionally an SMS + team-messaging notification to the on-call manager, alongside the existing reporter-facing notifications; back it with a per-tenant notification-rules/on-call-rota config.

### [MEDIUM] assignment-rules-never-applied
File: apps/web/app/(app)/(public)/contact/actions.ts

FR-I-3 requires assignment rules to route incoming enquiries top-down, first-match-wins. Verified evaluateAssignmentRules (packages/validators/src/assignment-rule.ts) is referenced only by the package export, its own test, and AssignmentRuleTester.tsx — no enquiry-creation path (contact/valuation/viewing/properties[slug]) invokes it. The Enquiry model (packages/db/prisma/schema.prisma 615-637) has no assignedAgentId/assigned_user_id/priority column, so even an evaluated rule has nowhere to persist a routing result. Configured rules therefore never fire; staff can build rules that silently do nothing.

**Fix:** Add an assigned-agent (and priority) column to the Enquiry model and invoke evaluateAssignmentRules in every enquiry-creation action, persisting the first-match assignment; add integration coverage that a created enquiry is routed per the configured rules.

### [MEDIUM] repair-submission-produces-no-enquiry
File: apps/web/app/(app)/(public)/report-a-repair/actions.ts

FR-I-1 and master spec §I.1 require every public form to write an enquiry row with the correct lead_type; the spec's form-inventory (lines 106, 1230, 1977) explicitly lists repair submissions as writing 'enquiries + repair_requests' (a dual write, lead_type=repair_request). The repair action creates only tx.repairRequest.create and never an Enquiry, whereas valuation/viewing/contact/properties[slug] actions all create enquiry rows. The LeadType enum (schema ~1445) includes repair_request. Repair submissions therefore never appear in the unified enquiry queue (/admin/enquiries, FR-H-3) or the leads-by-source pipeline reports.

**Fix:** In the repair submit transaction, also create an Enquiry with leadType='repair_request' linked to the RepairRequest (mirroring the viewing/valuation dual-write), so repairs surface in the unified CRM queue and pipeline reports.

### [LOW] audit-log-user-agent-never-captured
File: apps/web/app/(app)/admin/audit/AuditLogTable.tsx

FR-H-17 (and FR-N-14 / PRODUCT.md §170) require the audit trail to capture actor, full diff, IP AND user-agent. The audit() helper accepts userAgent and getRequestUserAgent() exists, but only cookie-consent/actions.ts ever supplies it; verified setRepairStatus passes only ip, and no admin state-change action (updateEnquiryStatus, convertEnquiry, addEnquiryNote, assignContractor, createAssignmentRule, setRepairStatus) passes userAgent. AuditLogTable renders columns When/Action/Actor/Target/IP/Change with no user-agent column. Every admin audit row's user_agent is therefore null and the forensic field is absent from both capture and display.

**Fix:** Capture getRequestUserAgent() in each admin state-change action and pass it to audit(userAgent), and add a user-agent column (or detail view) to AuditLogTable so the FR-H-17 forensic field is populated and visible.

### [LOW] repair-urgency-sla-not-configurable
File: apps/web/app/(app)/lib/repair-sla.ts

FR-G-5 requires an admin-editable urgency taxonomy with per-urgency SLA targets and FR-G-9 requires configurable SLA-badge thresholds. The urgency set is a fixed Prisma enum (RepairUrgency: emergency/urgent/standard/low) and the SLA targets (TARGET_HOURS 4h/24h/48h + LOW 5 working days) plus the 50%/75% bands are module constants with no per-tenant config model or admin screen; the file's own comment admits 'the admin-editable taxonomy + per-urgency SLA config is FR-G-5, a later slice'. The hardcoded values are spec-compliant defaults, but the configurability requirement is unmet.

**Fix:** Introduce a per-tenant urgency/SLA config model (targets + badge thresholds) with an admin screen, and have slaDueAt/slaRisk read it (falling back to the current §G.4 defaults), satisfying FR-G-5/FR-G-9.

---

## Spec fidelity: EPIC-T accounts, EPIC-U workers, EPIC-AC feedback, EPIC-O SEO, EPIC-W calculators (fidelity-accounts-workers-content)
confirmed: 7 | refuted: 1

### Auditor summary
Swept the five epics against their dev-briefs, reading the actual implementations (workers digest/match/index, feedback token+actions+moderation+aggregate, account save/search/profile actions, SEO seo.ts/sitemap/robots/proxy/redirects, and the SDLT/mortgage engines). Core guards held everywhere I checked: writes are fail-closed on getCustomerSession/requireStaffPermission, mutations run in one withTenant tx with audit(), the feedback form carries G5 consent + G8 Turnstile, and the feedback token is correctly tenant-bound (no cross-tenant replay). Mortgage math (standard amortisation) and SDLT progressive-band math are correct.\n\n8 findings. Highest: the 'one-time' feedback token is not single-use (stateless HMAC, no consumption marker, no DB uniqueness, no dedup in submit) — replay lets a holder inflate the public reviews aggregate and an agent's rating (FR-AC-2). Mediums: 'instant' saved-search cadence is selectable but has no delivery path (FR-T-7 / missing instant worker); shipped DEFAULT_SDLT_CONFIG uses pre-April-2025 rates so fresh tenants show wrong SDLT (FR-W-2); digests fire at fixed server time not tenant-local (FR-U-9, acknowledged); the admin scheduled-tasks console (FR-U-7/8/10) does not exist. Lows: area-guide slug-change 301 missing (FR-O-12, properties done); newly saved searches blast the whole back-catalogue on first digest; JSON-LD/sitemap gaps (floorSize, Person/branch, 'team' child).\n\nCoverage (impl=implemented, part=partial, miss=missing):\nEPIC-T: T-1 impl, T-2 impl, T-3 impl, T-4 miss(no settings/2FA route), T-5 impl, T-6 impl, T-7 part(instant undelivered), T-8 impl, T-9 miss, T-10 miss, T-11 impl, T-12 miss, T-13 miss, T-14 part(EPIC-N), T-15 part.\nEPIC-U: U-1 impl, U-2 impl, U-3 part(cadence only), U-4 impl, U-5 part(logs not worker.<name>.run events), U-6 part(no explicit backoff), U-7 miss, U-8 miss, U-9 miss, U-10 miss; catalogue mostly unbuilt (owned by other NOT_STARTED epics).\nEPIC-AC: AC-1 miss(no trigger/token minter), AC-2 part(not single-use), AC-3 impl, AC-4 impl, AC-5 impl, AC-6 impl, AC-7 impl, AC-8 miss, AC-9 miss, AC-10 impl, AC-11 miss, AC-12 miss.\nEPIC-O: O-1 impl, O-2 impl, O-3 impl, O-4 impl, O-5 part(no floorSize), O-6 impl, O-7 part(no Person/branch), O-8 part(no team child), O-9 impl, O-10 not-verified(CI), O-11 impl, O-12 part(properties only), O-13 part.\nEPIC-W: W-1 impl, W-2 impl-math/stale-default, W-3 impl, W-4 impl, W-5 impl, W-6 impl, W-7 impl, W-8 impl, W-9 impl, W-10 impl, W-11 part(unverified), W-12 impl.

### [HIGH] feedback-token-not-single-use
File: apps/web/app/(app)/lib/feedback-access.ts

FR-AC-2 requires a 'one-time-token' feedback URL, but the token is a stateless HMAC. verifyFeedbackToken (feedback-access.ts:69-105) validates only signature + `nowMs >= expiresAtMs`; there is no consumed marker, and submitFeedback ((public)/feedback/[token]/actions.ts:49-138) re-verifies statelessly and inserts a new Feedback row on every call with no dedup, while the model has no unique constraint (schema.prisma:887-909). TTL is 30 days (FEEDBACK_TOKEN_TTL_MS) and feedbackAggregate (lib/feedback-aggregate.ts) averages ALL rows with no status filter (FooterReviews passes no where), so one retained link can submit repeated ratings that move the public reviews badge and the tagged agent's league-table rating. Turnstile (G8) and the token's tenant/trigger/agent binding cap but do not remove replay.

**Fix:** Enforce single use: persist a consumed/nonce marker (or a unique (triggerEntity, triggerEntityId, respondentRef) constraint) and reject a token whose feedback already exists; additionally scope feedbackAggregate to approved feedback so unmoderated/replayed rows cannot move the public badge.

### [MEDIUM] saved-search-instant-frequency-never-delivered
File: apps/web/app/(app)/account/searches/SavedSearchRow.tsx

'instant' is a selectable, persisted cadence — ALERT_FREQUENCIES includes it (packages/validators/src/saved-search.ts:25) and both UIs offer it (SavedSearchRow.tsx:26, (public)/properties/SaveSearchControl.tsx:22) — but nothing delivers it. The digest worker's CADENCES excludes instant (saved-search-digest.ts:24-25), index.ts schedules only daily/weekly crons (index.ts:47-48), and the catalogue's `saved_search_alerts_instant` (triggered on property.published) is unimplemented — publish-actions.ts:71 / publish-preflight-actions.ts:182 only write an audit action, no alert enqueue. A customer who selects Instant silently receives nothing (worse than Off).

**Fix:** Either implement the property.published -> instant alert worker, or remove/disable the 'instant' option in the UI until delivery exists, so the offered cadence matches actual behaviour.

### [LOW] stale-default-sdlt-bands
File: apps/web/app/(app)/lib/stamp-duty.ts

DEFAULT_SDLT_CONFIG (stamp-duty.ts:110-126) ships pre-April-2025 England/NI figures — 250,000 nil-rate band with no 2% 125k-250k band, FTB thresholds 425k/625k, a 3% additional-property surcharge, lastUpdated '2024-04-01' — whereas current UK rules are 0%/125k, 2% 125k-250k, 5% to 925k, FTB 300k/500k, 5% surcharge. loadSdltConfig (lib/sdlt-config.ts) falls back to this default when a tenant has no row, so a fresh tenant understates SDLT on a public page (e.g. a 300k home-mover shows ~2,500 vs 5,000). Progressive-band math is correct. Mitigated (hence low): the code documents the defaults as illustrative/'operator must verify' and the UI shows a 'for guidance only' disclosure plus the lastUpdated date.

**Fix:** Refresh DEFAULT_SDLT_CONFIG to the current HMRC bands and bump lastUpdated, so the out-of-the-box calculator is accurate for tenants that have not configured custom bands.

### [LOW] digest-not-tenant-local-timezone
File: apps/workers/src/index.ts

FR-U-9 requires daily/weekly per-tenant work to be scheduled in each tenant's local time zone (user story: 'arrive at 7am my time'), but index.ts hardcodes SAVED_SEARCH_DAILY_CRON='0 7 * * *' / WEEKLY='0 8 * * 1' (index.ts:47-48) and runSavedSearchDigestTick fans out across all tenants at that single server-time instant with no per-tenant TZ resolution. The code comment (index.ts:42-46) concedes this is a deferred V1 limitation. Digests still send, only at the wrong local hour — hence low.

**Fix:** Resolve each tenant's timezone and fire the daily/weekly digest at the tenant-local target hour (e.g. an hourly tick that dispatches tenants whose local time matches the target).

### [MEDIUM] no-admin-scheduled-tasks-console
File: apps/web/app/(app)/admin

FR-U-7/8/10 require an admin scheduled-tasks console (list every worker with last-run/next-run/outcome/avg-runtime + Run-now, pause without redeploy, auto-discovery of new workers). No such route exists: the admin tree is audit/contacts/enquiries/feedback/properties/repairs/reports/settings/users only (settings: seo/redirects/stamp-duty/mortgage). A grep for scheduled-task/Run now/pause worker/last-run matches only docs and design/canvas/screens/admin/scheduled-tasks.html, never app code. Workers are wired directly in apps/workers/src/index.ts via upsertJobScheduler with no pause flag, run-now trigger, or readable registry.

**Fix:** Build the admin scheduled-tasks console backed by a worker registry/run-log (last-run/next-run/outcome/avg-runtime), with Run-now and pause-without-redeploy controls and auto-discovery so new workers surface without manual entry.

### [LOW] area-guide-slug-change-no-301
File: apps/web/app/(app)/lib/area-guides.ts

FR-O-12 requires slug changes on BOTH properties and area guides to auto-create 301s. Properties do (admin/properties/actions.ts:445-465 create a type 'r301' redirect + audit on slug change), but area guides expose only a read/sitemap model — there is no Payload collection and no areaGuide.create/update action anywhere under apps/web — so no slug-change redirect is created for /locations/[slug]. Because area guides have no app-side edit path at all, a slug change cannot currently be initiated in-app, limiting practical impact — hence low.

**Fix:** When area-guide authoring/editing is added, mirror the property slug-change handler to auto-create a 301 from the prior /locations/{slug} on any slug change.

### [LOW] seo-jsonld-and-sitemap-gaps
File: apps/web/app/(app)/lib/seo.ts

Structured-data/sitemap coverage is incomplete vs EPIC-O. FR-O-5 lists floor size for RealEstateListing, but propertyListingJsonLd (seo.ts:55-93) omits floorSize (the view model lacks it, per its own comment). FR-O-7 requires Person JSON-LD for team profiles and RealEstateAgent/LocalBusiness for branch pages, but seo.ts provides only Article (BlogPosting), Place, a site-wide RealEstateAgent and WebSite — no Person builder and no per-branch RealEstateAgent/LocalBusiness. FR-O-8 lists a 'team' child sitemap, but SITEMAP_CHILD_IDS = ['static','properties','pages','blog','areas'] (lib/sitemap-entries.ts:43) has no 'team' child.

**Fix:** Add floorSize to the listing JSON-LD once the property model carries floor area; add Person (team) and per-branch RealEstateAgent/LocalBusiness builders; and add a 'team' child sitemap id, alongside the corresponding team/branch surfaces.

---

## Test quality + TDD discipline (test-quality)
confirmed: 3 | refuted: 2

### Auditor summary
Swept test quality across apps/web (public form actions, admin actions, the router.refresh control family), apps/workers (notification/saved-search dispatchers), packages/validators, packages/entitlement, and packages/db (RLS, audit, schema-shape, integration). Overall the suites are stronger than typical: security-critical failure paths are well covered — Turnstile fail-closed and consent-missing paths exist across contact/valuation/register/report-a-repair/feedback/enquiry actions; RBAC deny tests exist for every admin action; quota enforcement (pass/exceed/boundary/unlimited) and requirePack denial are tested; the notification dispatcher is cleanly DI-tested for claim atomicity/idempotency/failure; turnstile.js is exhaustively fail-closed tested; and RLS is verified both via pglite (policy shape) and Testcontainers (real engine). Five findings: (high) the real-engine integration suites — the only assertions that RLS, the 0006 composite tenant FK, and the PostGIS radius SQL actually work — are excluded from the fast unit run and have no CI job, so they never execute; (medium) the router.refresh 'flaky family' asserts the refresh spy synchronously after await user.click while the actual call happens in a post-resolve useEffect (fix: await waitFor, as SeoMetadataEditor already does); (medium) the saved-search worker matcher is a hand-maintained twin of catalogue buildWhere with parity asserted only against literals (drift risk); (low) the import path stubs insertPropertyRow so the real batch insert/audit is never exercised; (low) prisma schema-shape tests pin source text, not DB behavior. Note: I did not flag the in-flight property-search advanced-filter edit per instructions.

### [HIGH] ci-never-runs-integration-suites
File: .github/workflows/ci.yml

CI's only test step runs `pnpm run test` (turbo -> `vitest run`), and both vitest configs exclude `*.integration.test.ts` (apps/web/vitest.config.ts:24, packages/db/vitest.config.ts:9). No CI job invokes the `test:integration` scripts (they exist in apps/web/package.json:16 and packages/db/package.json:21) nor provisions Docker/Postgres, so the Testcontainers suites that are the ONLY real-engine verification of RLS tenant isolation, the 0006 composite tenant FKs, and the assembled PostGIS radius SQL never execute in CI. Those suites are additionally `describe.skipIf(!DOCKER)` (real-postgres.integration.test.ts:54, properties.integration.test.ts:37) so they green-skip locally without Docker. The unit rls.test.ts only exercises a synthetic `widgets` table (rls.test.ts:21), not the real schema/migrations. Compounding it, source comments (rls.test.ts:12, real-postgres.integration.test.ts:10-11) assert this integration runs 'via Testcontainers in CI' — which is false. A migration regression that silently breaks RLS or the cross-tenant FK would pass CI green.

**Fix:** Add a CI job that runs `pnpm --filter @estate/db test:integration` and `pnpm --filter @estate/web test:integration` against a Docker/Postgres+PostGIS service (fail if Docker is unavailable rather than skip), and correct the misleading 'runs in CI' comments.

### [MEDIUM] saved-search-matcher-parity-drift
File: apps/workers/src/saved-search-match.test.ts

propertyMatchesSearch (saved-search-match.ts:68) is a hand-maintained in-memory re-implementation of the catalogue filter that lives separately in buildWhere (apps/web/app/(app)/lib/properties.ts:167-196) and its raw-SQL twin searchPropertiesNear (properties.ts:332-353). The test pins the JS twin only against hand-written literal expectations; no shared fixture is fed through both implementations and no test compares their outputs. Adding or altering a filter in buildWhere (or the SQL variant) would fail no saved-search test, so the digest matcher can silently diverge from the catalogue — surfacing non-matching properties or missing matches in alert emails while every test stays green.

**Fix:** Add a parity harness that runs a shared set of (filter, property) fixtures through both the catalogue predicate and propertyMatchesSearch and asserts identical results, or extract a single shared filter-semantics spec consumed by both so drift cannot go undetected.

### [LOW] import-insertpropertyrow-overmock-batch-gap
File: apps/web/app/(app)/admin/properties/import/actions.test.ts

Both import suites (actions.test.ts:43-53, quota-enforcement.test.ts:49-59) vi.mock('../actions.js') to replace insertPropertyRow with a fake returning `slug-${reference}` (unique per reference). The real insertPropertyRow (actions.ts:235) + disambiguateSlug (actions.ts:113) are exercised only via single-row createProperty/updateProperty tests (actions.test.ts:135, 283), each covering exactly one collision -> `-2`. So: (a) multi-row slug collisions WITHIN one import run — where insertPropertyRow accumulates `taken` across rows so duplicate bases must mint base-2/base-3... — are never exercised end-to-end; (b) disambiguateSlug's loop past suffix 2 (base-3+) is untested; (c) the real per-row property.created audit emitted during a batch import is mocked out and unverified. The over-mock itself is documented/intentional test design; the untested in-run collision accumulation and multi-suffix path are the genuine gap.

**Fix:** Add a direct unit test for disambiguateSlug covering base -> base-2 -> base-3 accumulation, and/or an import test that drives the real insertPropertyRow across multiple rows minting colliding base slugs to prove in-run disambiguation and per-row audit emission.

---
