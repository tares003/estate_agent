# EPIC-P — Technology requirements (implementation-neutral)

**Master spec reference:** Section P.
**Status:** CONTEXT (no implementation work).
**Paired design brief:** [design-briefs/v1/EPIC-P-technology-requirements.md](../../design-briefs/v1/EPIC-P-technology-requirements.md).

## Purpose

This brief is informational. It carries the **set of technology capabilities** that the chosen implementation, whatever it is, must provide. No code is written from this brief; instead, every other epic's brief refers back here when it relies on a generic capability.

## What this epic establishes

The platform's implementation must include, at minimum, the capability set in master spec Section P.1: server-rendered web, relational database with strong consistency, spatial querying, scalable object storage with pre-signed uploads, CDN, transactional email, SMS, anti-spam, mapping, analytics with consent gating, error monitoring tagged per tenant, structured logging with per-tenant filtering, background jobs, secrets management, and CI/CD with automated test gates.

The build-vs-buy decisions in master spec Section P.2 must be settled per module before the corresponding epic begins. The team's choices are recorded in `CLAUDE.md` section 9 when the stack is committed.

## Acceptance

Section P is reflected in every other epic's "Open questions" list, and is settled before Sprint 02 begins.

## Dependencies

None.

## Open questions

The entire section is a list of questions to settle when the stack is chosen. The four most pressing for Sprint 02 planning:

1. Confirm the relational database product.
2. Confirm the transactional email provider (drives email-template format).
3. Confirm the mapping provider (drives map-tile cost and rendering library).
4. Confirm the chosen build-vs-buy outcome for each module in master spec Section P.2.
