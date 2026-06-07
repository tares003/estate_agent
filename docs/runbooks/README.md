# Runbooks

Operational procedures for the self-hosted deployment. Each runbook is a step-by-step a human (or future agent) can follow under pressure.

## Required runbooks (authored as the capabilities they describe are built)

| Runbook | Covers | Built with |
|---|---|---|
| `provisioning.md` | Create a tenant (INSERT tenant row, subdomain, RLS context) — 10-minute target (§S.5). | EPIC-S (B13) |
| `restore.md` | Full DB restore; per-tenant row-filtered restore; media restore from `restic`; restore-test. | ADR-0003 / B13 |
| `suspend.md` | Suspend / unsuspend a tenant; the suspended-tenant holding page. | EPIC-S (B13) |
| `rotate-secrets.md` | Rotate SOPS/age keys and the SMTP encryption keys (MultiFernet) without downtime. | ADR-0002 / B13 |
| `incident-response.md` | Triage, containment, comms, sub-processor-breach notification. | EPIC-S / EPIC-AB |
| `custom-domain.md` | Tenant custom-domain wizard + verification (day-one criterion §S.6). | EPIC-S (B13) |

Status: **skeleton** — index only; each runbook lands with its capability.
