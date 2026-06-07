# Estate Agent Platform — Project Foundation

This repository is the **requirements foundation** for a multi-tenant SaaS platform for UK estate agencies. It does not yet contain any code. Its purpose is to capture, completely and unambiguously, *what the platform must do*, *what information it must capture*, *what user journeys it must support*, and *what non-functional qualities (performance, security, availability, cost, compliance) it must meet*, **before** an implementation team commits to a stack and starts building.

When the team is ready to build, an autonomous coding agent should be able to read everything in this folder, derive its own working plan, and proceed. The repo is intentionally structured to be discoverable by that agent.

## What's in this folder

```
.
├── README.md                              ← you are here
├── CLAUDE.md                              ← repo conventions for AI agents
├── PRODUCT.md                             ← canonical naming, tier model, compliance regime, brand voice
├── DESIGN.md                              ← design tokens (colour, type, spacing, radius, motion)
├── motion-spec.md                         ← motion / animation requirements
├── design-requirements.md                 ← accessibility, responsive, performance requirements that drive design
├── .design-canvas-url                     ← location of the design canvas (status: TBD)
│
├── Property-Agency-Website-Implementation-Spec.md
│                                          ← the master requirements specification (A through S)
│
├── dev-todo.md                            ← top-level dev work index
├── designer-todo.md                       ← top-level designer work index
├── dev-todo-sprint-01.md                  ← current-sprint dev scope
├── designer-todo-sprint-01.md             ← current-sprint designer scope
│
├── dev-briefs/
│   ├── v1/                                ← V1 per-epic dev briefs (EPIC-A through EPIC-S)
│   └── sprint-01/
│       ├── _cross-cutting.md              ← migrations, shared packages, perf budgets, DoD
│       └── _tdd-protocol.md               ← RED/GREEN/REFACTOR discipline, coverage gates
│
└── design-briefs/
    └── v1/                                ← V1 per-epic design briefs (mirrors dev-briefs/v1/)
```

## How to read this repo

1. **Start with `PRODUCT.md`.** It defines what we call things and what we never call them, the tier model, the compliance regime, and the brand voice. Every other document obeys those rules.
2. **Then read `DESIGN.md`, `motion-spec.md` and `design-requirements.md`.** Together these set the visual and interaction baseline that every UI decision must defer to.
3. **Then read the master spec** (`Property-Agency-Website-Implementation-Spec.md`). It is the single source of truth for what the platform must do, organised into sections A through S.
4. **Then read the discipline docs** under `dev-briefs/sprint-01/`. They describe how work is sequenced, how tests are written, and what "done" means.
5. **Then look at the index files** (`dev-todo*.md`, `designer-todo*.md`). They list every epic and ticket and link to its brief.
6. **Then dive into the per-epic briefs** under `dev-briefs/v1/` and `design-briefs/v1/`. Each brief decomposes one section of the master spec into user stories, acceptance criteria and test mapping.

## Current state

- **Architecture / stack:** undecided. The master spec is deliberately implementation-neutral. Section P captures the technology capabilities the chosen stack must provide; Section S captures the non-functional requirements for hosting and multi-tenancy. The team will pick the stack when target customer profile, year-1 tenant count and team operational capacity are confirmed.
- **Design canvas:** not yet created. `.design-canvas-url` is a placeholder. When the design canvas is set up (in any visual design tool — the choice is open), record its URL or local path in that file.
- **Code:** none yet. The autonomous build prompt will run when the foundation set is approved and a stack is chosen.
- **Brief set status:** **Locked at 29 epics (A through AC) on 2026-06-05.** Subsequent additions require an amendment PR against the index files and a corresponding update to the audit report.

## Master spec — section map

| Section | Title | What it captures |
|---|---|---|
| A | Executive summary | What the platform is, the 7 surfaces, the major architectural decisions, out-of-scope items |
| B | Website feature audit | The canonical 60-feature inventory with priority and admin-configurability |
| C | Public pages and sitemap | Every public page with purpose, sections, CTAs, CMS-managed and static content, forms, notifications |
| D | Backend configurable areas (CMS) | Page-builder section types and the editorial surface that is CMS-managed |
| E | Static information areas | Items that change rarely (company registration, regulatory memberships) |
| F | Property listing data requirements | Every attribute a property record must carry, including per-vertical extensions |
| G | Repair system specification | Tenant journey, admin workflow, categories, urgency taxonomy, status workflow, data |
| H | Admin dashboard specification | 28 sub-sections covering every admin screen, role matrix, settings hierarchy |
| I | CRM and lead workflow | Lead taxonomy, statuses, assignment rules, reporting |
| J | Data requirements (entities and attributes) | The complete data model in implementation-neutral form |
| K | Interface capabilities | What the platform must expose to public, customer, admin and outbound integration audiences |
| L | Frontend components | The component inventory across public site, customer account and admin |
| M | UX and visual design system | Design principles, colour tokens, typography, spacing, components, motion, accessibility |
| N | Security and GDPR checklist | Authentication, authorisation, input validation, file uploads, rate limiting, GDPR, audit |
| O | SEO checklist | URLs, metadata, structured data, sitemap, performance, internal linking, local SEO |
| P | Technology requirements (implementation-neutral) | Required technology capabilities and build-vs-buy decisions per module |
| Q | Build roadmap (functional phases) | Eight phases with outcomes, features, dependencies, acceptance criteria |
| R | Cross-cutting requirements (definition of done) | DoD, domain glossary, open questions, closing acceptance |
| S | Non-functional requirements for hosting and multi-tenancy | Cost, isolation, availability, residency, recovery, provisioning, ops sustainability |

## Conventions for changes to this repo

- The master spec is the single source of truth. If anything in a brief, an index, a design document, or eventually any code, contradicts the master spec, the master spec wins until it's amended.
- Naming follows `PRODUCT.md`. Always.
- Design follows `DESIGN.md`. Al