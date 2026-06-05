# EPIC-K — Interface capabilities (design)

**Dev brief:** [dev-briefs/v1/EPIC-K-interface-capabilities.md](../../dev-briefs/v1/EPIC-K-interface-capabilities.md).
**Master spec reference:** Section K.
**Status:** CONTEXT (informs loading, empty, error, success states across all consuming surfaces).

## Purpose

Informational. The capability surface itself has no design but every capability's response shape informs the four states (loading, empty, error, success) that every consuming UI must render.

## How designers use this brief

- For every UI that consumes a list capability, design loading, empty and error states.
- For every UI that consumes a mutating capability, design submitting and success states.
- For every UI that consumes a paginated capability, design the pagination control and the "loading next page" indicator.

## Open design questions

None at this level.
