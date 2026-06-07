# @estate/config

Shared lint, format and type-check configuration **and the twelve CI guards (G1–G12)** that enforce the project's non-negotiables.

## Public surface

- `eslint/` — flat ESLint config presets (base, react, node) consumed by every TS package via `extends`.
- `tsconfig/` — shared `tsconfig` presets layered on the root `tsconfig.base.json`.
- `guards/` — one module per CI guard, each exposing a `run(diff)` entrypoint and a CLI. Each guard ships with a **deliberate-violation fixture** proving it fails closed.

## CI guards (defined in `dev-briefs/sprint-01/_cross-cutting.md` §4 + EPIC-AD for G12)

| Guard | Catches |
|---|---|
| G1 | Production-code diff without a corresponding test diff (RED-before-GREEN). |
| G2 | Coverage on touched files below the `_tdd-protocol.md` §5 threshold. |
| G3 | A changed public route exceeding the JS/CSS bundle budget (`design-requirements.md` §3). |
| G4 | A state-changing handler with no `audit()` call (or documented exemption). |
| G5 | A personal-data form schema without a `gdpr_consent` field. |
| G6 | A forbidden noun from `PRODUCT.md` §3 (canonical-naming violation). |
| G7 | A raw hex / px / ms / easing where a design token exists. |
| G8 | A price/valuation/rent/calculator/review/AI surface missing its `PRODUCT.md` §8 trust marker. |
| G9 | A new public/admin route with an AA accessibility violation. |
| G10 | A new external-service dependency absent from the sub-processor manifest. |
| G11 | A component/page test missing a viewport assertion at any of the 7 breakpoints. |
| G12 | A pack-dependent handler/route/worker/sidebar/section without `requirePack()` / `isPackEnabled()`. |

## Discipline

Built **test-first**: each guard's deliberate-violation fixture is the RED test (the guard must reject it) and a clean fixture is the GREEN companion (the guard must pass it). Coverage gate: **100% line + branch** (shared package).

Status: **skeleton** — directory established in Phase B0; guards implemented in the Quality-gates phase, with the foundation-relevant guards (G1, G2, G6, G7, G11, G12) wired early so later packages are checked as they land.
