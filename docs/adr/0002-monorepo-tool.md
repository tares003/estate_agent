# ADR 0002 — Monorepo orchestrator: Turborepo vs pnpm workspaces alone

- **Status:** Accepted — ratified by the platform owner on 2026-06-08
- **Date:** 2026-06-08
- **Deciders:** Platform engineering
- **Gates:** Phase B0 (workspace scaffold). Per `AGENTS.md` §9, the monorepo skeleton is not committed until this ADR is `Accepted`.

## Context

The recorded stack (`AGENTS.md` §9) is a single TypeScript monorepo with `apps/web`, `apps/workers`, and ~10 `packages/*`. Both apps share the same packages (db, auth, ui, validators, etc.). The open question is whether to orchestrate the monorepo with:

- **pnpm workspaces alone** — package manager handles linking and dependency resolution; CI runs each package's scripts directly; no separate build orchestrator.
- **Turborepo (on top of pnpm workspaces)** — adds a build/test/lint orchestrator with remote caching, dependency-aware task running (`turbo run build` only rebuilds what changed), and parallel execution.

## Decision drivers

1. **CI speed** — `turbo run` with caching can shave significant time off CI by skipping unchanged packages.
2. **Local DX** — `turbo dev` runs `apps/web` and `apps/workers` together with one command.
3. **Operational simplicity** — one tool vs two.
4. **Lock-in** — Turborepo is Vercel-owned; pnpm is community-owned.
5. **Familiarity** — most TS monorepo devs have used Turborepo; pnpm workspaces alone is less common at scale.

## Considered options

### Option A — Turborepo on pnpm (recommended)

- pnpm handles dependencies; Turborepo handles task orchestration.
- `turbo run build --filter=apps/web` builds only what changed.
- Local remote cache (free) shared between developers; optional Vercel-hosted remote cache.
- Standard pattern for a TS monorepo with multiple apps and shared packages.

### Option B — pnpm workspaces alone

- Lighter footprint; one less tool.
- Scripts in the root `package.json` orchestrate task running (`pnpm -r run build`, `pnpm --filter web build`).
- No caching layer — CI rebuilds everything each time.
- Sufficient if the monorepo stays small.

## Decision

**Adopt Option A — Turborepo on pnpm.** (Ratified 2026-06-08.) The reasoning:

- With ~10 packages and 2 apps, dependency-aware task running pays back almost immediately on CI time.
- Local DX of `turbo dev` running both `apps/web` and `apps/workers` together is meaningful for the day-to-day developer experience.
- Turborepo is MIT-licensed and the local cache costs nothing; we can opt into the Vercel-hosted remote cache later if CI time becomes a bottleneck, or run our own remote cache via a self-hosted server.
- The lock-in is small (Turborepo is a CLI; migrating to another orchestrator is a `package.json` change).

## Consequences

- Root `turbo.json` defines the task graph (`build`, `test`, `lint`, `type-check`).
- Each package declares its `package.json` `scripts`; Turborepo discovers them.
- CI uses `turbo run build test lint type-check --cache-dir=.turbo --token=$TURBO_TOKEN` (or local cache only if no token).
- The pnpm lockfile lives at the repo root; one `tsconfig` base extended per package.

## Follow-ups before `Accepted`

- Ratify with the platform owner.
- Decide on the remote-cache strategy (local-only for V1; revisit if CI time grows) — recorded here as a sub-note.
