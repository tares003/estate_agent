# @estate/i18n

Translation-key registry and runtime accessor. **V1 ships only `en-GB`**, but every user-facing string in every shell must resolve through a key — inline string literals fail the i18n lint (`_cross-cutting.md` §6).

## Public surface

- `t(key, args?)` — resolve a key with interpolation.
- `defineMessages({...})` — co-locate a component's keys with type-safe inference.
- The `en-GB` message catalogue (the only locale bundled in V1).

UI copy follows the **brand voice (`PRODUCT.md` §7)** and the **UI vocabulary (`PRODUCT.md` §4)**; AI-generated copy is human-reviewed before shipping (`AGENTS.md` §8).

## Discipline

Tests assert key resolution, interpolation, missing-key behaviour, and that catalogues have no orphan/duplicate keys. Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B1/B2.
