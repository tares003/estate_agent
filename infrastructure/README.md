# infrastructure

Infrastructure-as-code and deployment definitions for the **pure-self-hosted Hetzner** model (`AGENTS.md` §9; master spec §S.13a).

## Contents (filled in as deployment is set up)

- `compose/` — Docker Compose for the Hetzner-hosted services: `apps/web` (Next.js + Payload), `apps/workers` (BullMQ), PostgreSQL 16 + PostGIS, Redis, the local-filesystem media volume.
- `terraform/` — Cloudflare resources only (DNS, free-tier CDN config). No paid Cloudflare features; storage is local-filesystem, so **no object-storage buckets**.
- `coolify/` — Coolify/Dokku deployment manifests; CI builds one Docker image → GitHub Container Registry → Coolify pulls on tag and runs it as two containers (web + workers, different entrypoints).
- `secrets/` — SOPS + age encrypted secrets (`*.sops.yaml`). Decryption keys live in GitHub Actions secrets at deploy time; raw `.env` is git-ignored.
- `cloudflared/` — tunnel config for local dev against the origin.

## Backup (ADR-0003)

Daily `pg_dump` + `restic` snapshot of the media tree to a Hetzner Storage Box; a scheduled restore-test verifies recoverability. Per-tenant restore is a row-filtered `pg_dump` runbook (`docs/runbooks/restore.md`).

## Region

UK/EU only (§S.7) — Hetzner Falkenstein / Nuremberg / Helsinki.

Status: **skeleton** — Compose + Terraform land alongside the first deployable surface.
