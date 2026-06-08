# ADR 0003 — Backup target & geo-separation

- **Status:** Proposed — reviewed 2026-06-08; deferred to the launch-readiness checklist (not a foundation blocker). Option A remains the recommendation; ratify before the first paying tenant.
- **Date:** 2026-06-07
- **Deciders:** Platform engineering + operations
- **Gates:** Production launch / first paying tenant. Not a blocker for foundation phases.

## Context

The recorded stack is **pure self-hosted on Hetzner** with **local-filesystem object storage** and **PostgreSQL on the same box** (`AGENTS.md` §9; master spec §S.13a). Backups must cover both the database (`pg_dump`) and media (the local-filesystem `StorageBackend` tree). Master spec §S non-functional requirements demand a recovery story; §S.7 mandates UK/EU data residency.

The tension: the cheapest, simplest target (a **Hetzner Storage Box**) sits with the **same provider** as the primary — so a provider-level outage or account compromise is a correlated failure. True geo/provider separation costs more and adds an egress path.

## Decision drivers

1. **Recovery objectives** — daily `pg_dump` + `restic` media snapshot satisfies the documented RPO/RTO for V1 scale.
2. **Data residency** — backup target must be UK/EU (§S.7).
3. **Provider-correlated failure** — is same-provider backup acceptable for V1?
4. **Cost** — flat, predictable, small.
5. **Operational simplicity** — one `restic` job, one runbook.

## Considered options

### Option A — Hetzner Storage Box, `restic` (recommended for V1)

- Cheap, EU-region, trivial to mount; one `restic` repo covers media; `pg_dump` piped to the same repo.
- `restic` gives encryption, deduplication, snapshot retention, and verifiable restores.
- **Caveat:** same provider as primary → correlated-failure risk.

### Option B — Off-Hetzner EU target (rsync.net / Backblaze B2 EU / Cloudflare R2 EU), `restic`

- True provider separation; survives a Hetzner-account-level incident.
- Slightly higher cost + an egress path to manage; still `restic`, so the runbook is nearly identical.

### Option C — Both (A as primary fast-restore, B as weekly geo-replica)

- Best resilience; daily local-fast restore from A, weekly geo-separated copy in B.
- Marginally more cost + a second scheduled job.

## Decision (recommended)

**Adopt Option A (Hetzner Storage Box + `restic`) as the committed V1 target, with a documented upgrade path to Option C before scaling.** For a single-box V1 the simplicity and cost win; the correlated-failure risk is explicitly accepted and logged. **Before onboarding tenants whose contracts demand provider-independent DR**, add the Option B weekly geo-replica (→ Option C). This is captured as a launch-readiness checklist item, not deferred indefinitely.

## Consequences

- `docs/runbooks/restore.md` documents: full DB restore, per-tenant row-filtered restore (`pg_dump --where="tenant_id='…'"`), and media restore from `restic`.
- Backup verification: a scheduled **restore-test** (restore into a throwaway DB, run a smoke query) — an untested backup is not a backup.
- The correlated-failure acceptance is recorded here and surfaced on the launch-readiness checklist with the Option C trigger.

## Follow-ups before `Accepted`

- Owner confirms whether any near-term tenant contract requires provider-independent DR (which would promote Option C to V1).
- Set concrete RPO/RTO numbers with operations and record them in the restore runbook.
