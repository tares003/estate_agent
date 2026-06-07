# EPIC-H — Admin dashboard

**Master spec reference:** Section H (H.1 through H.28).
**Pack:** Core (with pack-dependent admin sections gated).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-H-admin-dashboard.md](../../design-briefs/v1/EPIC-H-admin-dashboard.md).

## Purpose

Implement the full admin surface for staff: dashboard overview, property management, lead and viewing management, valuations, repairs, contacts, team and branches, testimonials, blog, area guides, CMS pages, menus, footer, SEO, media, email templates, notification rules, integrations, users and roles, settings, audit log, reports, scheduled tasks, search admin, keyboard shortcuts and command palette.

This is the largest epic. It is implemented across multiple sprints; this brief covers the V1 scope (foundation + must-have screens).

## Functional requirements

- **FR-H-1.** A dashboard overview screen shall present role-adaptive KPI cards, an alerts panel, and an activity feed. The composition shall persist per user.
- **FR-H-2.** Property management shall include the nine-tab property editor described in master spec Section H.5, the property list with filters and bulk actions, and the image manager with drag-drop reorder.
- **FR-H-3.** The lead queue at `/admin/enquiries` shall expose every enquiry of every lead type. Lead detail shall include an activity timeline with note, email, SMS and call-log composers.
- **FR-H-4.** A no-code assignment-rules editor shall allow staff to compose `IF <conditions> THEN <assignment>` rules and shall test rules against a sample lead before saving.
- **FR-H-5.** The calendar shall provide month, week, day and agenda views with per-agent and per-branch filters, conflict detection on assignment, and (optionally per user) two-way calendar sync.
- **FR-H-6.** The repair inbox shall surface SLA-breach risk per ticket and shall support bulk assignment.
- **FR-H-7.** Contacts shall be presented across four tabs (landlord / tenant / vendor / buyer) with duplicate detection and merge, and compliance items with automatic expiry alerts.
- **FR-H-8.** The CMS page-builder editor shall provide a sortable section list with live preview, versioning and scheduled publish (see EPIC-D).
- **FR-H-9.** The theme editor shall expose every overridable token per master spec Section H.11 with a live preview pane.
- **FR-H-10.** The email and SMS template editors shall support rich-text and source modes, a variable sidebar, conditional blocks, live preview and send-test.
- **FR-H-11.** A notification-rules matrix shall map every notifiable event against every channel with recipients, throttling and conditions.
- **FR-H-12.** A no-code form builder shall allow non-developers to create new forms from a field palette with conditional logic.
- **FR-H-13.** A workflow automation builder shall allow trigger → condition → action canvases with multi-step delays.
- **FR-H-14.** The integrations screen shall present every supported integration grouped by capability, with masked credentials, test-connection buttons and per-integration logs.
- **FR-H-15.** User and role management shall expose a per-role permission matrix and shall support custom-role composition. The role editor shall offer a "Test as role" simulator.
- **FR-H-16.** A three-level settings hierarchy (organisation / branch / user) shall be exposed with an "effective value" display and inheritance chain visualisation.
- **FR-H-17.** An audit-log viewer shall expose every state-changing action with full diff, actor, IP and user-agent.
- **FR-H-18.** Sixteen pre-built reports (per master spec Section H.21) shall be exposed with filters and export. A custom report builder shall allow pivot-style composition with scheduled email delivery.
- **FR-H-19.** A scheduled-tasks console shall list every cron job with last-run outcome and next-run time, with a run-now control.
- **FR-H-20.** Maintenance mode and feature flags shall be controllable from the settings hierarchy.
- **FR-H-21.** Global keyboard shortcuts and a command palette (`Cmd/Ctrl+K`) shall be available across every admin screen per master spec Section H.27 and H.28.

## User stories

Selected examples; the full list is implicit in every FR.

- As a branch manager, I want a single morning dashboard view to know what needs my attention today.
- As a property manager, I want to filter the lead queue by my own branch, my own assignments and `status=new` so I can triage in one screen.
- As a content editor, I want to schedule a homepage hero change for 6 am tomorrow without involving engineering.
- As a super-admin, I want to create a custom role for "Property Lister" that can create and edit properties but cannot publish them.
- As a marketing manager, I want to change the brand-accent colour and see every public surface update in real time.

## Acceptance criteria

- A new staff user can be invited, sign in, complete 2FA enrolment and reach the dashboard overview within 5 minutes of invitation.
- A property can be created end-to-end, including image upload and document upload, in under 5 minutes.
- Every administrative state change writes an audit-log entry.
- Role-based permissions are enforced at the data layer, not the UI layer. A custom role lacking `property.publish` cannot publish a property even via the underlying capability.
- Theme changes take effect across every public surface within seconds, with no rebuild required.
- The command palette finds any property, contact, lead, page, blog post, area guide, setting or staff action by typed query.

## Test mapping

```
FR-H-1  → tests/integration/dashboard-kpis.test.*, tests/component/dashboard-layout-personalisation.test.*
FR-H-2  → tests/e2e/admin-property-editor.spec.*
FR-H-3  → tests/e2e/admin-lead-queue.spec.*
FR-H-4  → tests/integration/assignment-rules.test.*
FR-H-5  → tests/integration/calendar.test.*
FR-H-6  → tests/integration/repair-inbox.test.*
FR-H-7  → tests/integration/contacts-tabs.test.*, tests/integration/duplicate-merge.test.*
FR-H-8  → tests/e2e/page-builder.spec.* (also in EPIC-D)
FR-H-9  → tests/integration/theme-editor.test.*
FR-H-10 → tests/integration/email-template-editor.test.*, tests/integration/sms-template-editor.test.*
FR-H-11 → tests/integration/notification-rules-matrix.test.*
FR-H-12 → tests/integration/form-builder.test.*
FR-H-13 → tests/integration/automation-builder.test.*
FR-H-14 → tests/integration/integrations-admin.test.*
FR-H-15 → tests/integration/role-matrix.test.*, tests/integration/role-simulator.test.*
FR-H-16 → tests/integration/settings-hierarchy.test.*
FR-H-17 → tests/integration/audit-log-viewer.test.*
FR-H-18 → tests/integration/reports-prebuilt.test.*, tests/integration/reports-custom.test.*
FR-H-19 → tests/integration/scheduled-tasks-console.test.*
FR-H-20 → tests/integration/maintenance-mode.test.*, tests/integration/feature-flags.test.*
FR-H-21 → tests/component/keyboard-shortcuts.test.*, tests/component/command-palette.test.*
A11y → tests/a11y/admin-routes.spec.*
Visual → tests/visual/admin-screens.spec.* (per major screen)
```

## Dependencies

- Every other implementation epic — EPIC-H is the surface through which every back-end capability is operated.
- EPIC-N — auth, RBAC, audit logging.
- EPIC-M — every primitive component.

## Open questions

1. Confirm the V1 scope of the no-code form builder — full feature set or simplified V1?
2. Confirm the V1 scope of the workflow automation builder — full feature set or simplified V1?
3. Confirm the V1 scope of A/B testing in the page builder (recommended: defer to Phase 8).
4. Confirm the policy on impersonation — who can impersonate whom, and what session indicators must show during impersonation.
