# CI guards — explainers

One page per guard (G1–G12): **what it catches** and **how to satisfy it**. Required by `_cross-cutting.md` §8. Each explainer is authored when its guard is implemented in `packages/config/guards/`.

| Guard | One-line | Explainer |
|---|---|---|
| G1 | PR-has-tests (RED before GREEN) | `g1-pr-has-tests.md` |
| G2 | Coverage threshold on touched files | `g2-coverage-threshold.md` |
| G3 | Per-route JS/CSS bundle budget | `g3-performance-budget.md` |
| G4 | Audit-log coverage on state changes | `g4-audit-log-coverage.md` |
| G5 | GDPR consent on personal-data forms | `g5-gdpr-consent.md` |
| G6 | Canonical-naming (forbidden nouns) | `g6-naming.md` |
| G7 | Design-token literal (no raw hex/px/ms) | `g7-design-token.md` |
| G8 | Trust markers on price/valuation/rent/etc. | `g8-trust-marker.md` |
| G9 | Accessibility smoke (AA) on new routes | `g9-accessibility.md` |
| G10 | Sub-processor manifest for new external deps | `g10-sub-processor-manifest.md` |
| G11 | Responsive coverage (7 breakpoints) | `g11-responsive-coverage.md` |
| G12 | Pack-entitlement wrapper on pack-dependent code | `g12-pack-entitlement.md` |

Every guard ships with a **deliberate-violation fixture** proving it fails closed, and a clean fixture proving it passes (the RED/GREEN pair for the guard itself).

Status: **skeleton** — index only; explainers land with their guards.
