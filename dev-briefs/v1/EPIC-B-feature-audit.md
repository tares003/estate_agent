# EPIC-B — Website feature audit (cross-reference)

**Master spec reference:** Section B (the 60-feature inventory).
**Status:** CONTEXT (no implementation work directly).
**Paired design brief:** [design-briefs/v1/EPIC-B-feature-audit.md](../../design-briefs/v1/EPIC-B-feature-audit.md).

## Purpose

This brief points at the canonical feature audit and explains how to use it.

The audit table in master spec Section B is the **inventory** of every public-facing feature with: where it appears, what the user does, what happens after submission, whether it needs backend logic, whether it's admin-configurable, what data it touches, and its priority (Must / Should / Nice).

## How other epics use this brief

- Every feature in Section B is owned by exactly one of the implementing epics (C, D, F, G, H, I, K, L). When the autonomous agent picks up a feature, it looks up the owning epic and reads that epic's brief.
- Priorities (Must / Should / Nice) drive sprint ordering — Must items must ship by Phase Q.4 of the build roadmap; Should items by Phase Q.5; Nice items by Phase Q.7.
- The audit table is also the **completion checklist** at the end of the sprint — see master spec Section R.4 "Closing acceptance".

## Acceptance

For every row in master spec Section B, there is a corresponding ticket in a feature epic by the time sprint planning is complete. No feature is orphaned.

## Dependencies

This epic depends on every feature-owning epic existing.

## Open questions

None at this level.
