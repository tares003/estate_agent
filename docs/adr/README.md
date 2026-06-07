# Architectural Decision Records

Each ADR captures one significant, hard-to-reverse decision: its context, the options weighed, the choice, and the consequences. Format is lightweight MADR.

## Status lifecycle

`Proposed` → `Accepted` → (later) `Superseded by NNNN` / `Deprecated`.

A `Proposed` ADR records a recommendation that has **not yet been ratified**. Per `AGENTS.md` §9, code that depends on a `Proposed` decision must not be committed until the ADR is `Accepted`.

## Index

| ADR | Title | Status | Gates |
|---|---|---|---|
| [0001](0001-api-framework.md) | API framework — Django Ninja vs DRF | **Proposed** | Phase B2 (API capability layer) |
| [0002](0002-smtp-credential-encryption.md) | Per-tenant SMTP credential encryption at rest | **Proposed** | EPIC-H §H.12 (tenant SMTP config screen) |
| [0003](0003-backup-target.md) | Backup target & geo-separation | **Proposed** | First paying tenant |

These three are the decisions `AGENTS.md` §9 lists as "intentionally NOT chosen yet". Ratify each (flip to `Accepted`) before starting the phase it gates.
