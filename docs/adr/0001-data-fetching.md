# ADR 0001 — Client-side data fetching: Server Actions only vs Server Actions + tRPC

- **Status:** Proposed (recommendation — awaiting ratification before EPIC-K scaffold)
- **Date:** 2026-06-08
- **Deciders:** Platform engineering
- **Gates:** EPIC-K (interface capabilities). Per `AGENTS.md` §9, no client-side data-fetching code is committed until this ADR is `Accepted`.

## Context

The recorded stack (`AGENTS.md` §9) is a single Next.js (App Router) application. Server-side reads use **React Server Components** with direct Prisma queries. Server-side mutations use **Server Actions**. The open question is how the **client-side interactive surfaces** (CRM queue with live updates, calendar drag-and-drop, repair inbox with bulk-assign, command palette) consume server data:

- **Option A — Server Actions only.** Every client→server call goes through a Server Action; client components use `useTransition` / `useFormStatus` and re-validate via `revalidatePath` / `revalidateTag`. No separate query layer.
- **Option B — Server Actions + tRPC.** Mutations go through Server Actions; complex client-side queries (search-as-you-type, dependent dropdowns, optimistic-UI lists) go through a typed tRPC layer with TanStack Query for cache, retries, and pagination.

The choice doesn't affect the public marketing site, the CMS-managed surfaces, or the property catalogue/detail — those are pure RSC + Prisma. It only affects highly interactive admin / portal surfaces.

## Decision drivers

1. **Type safety end-to-end** — both options give it; tRPC gives a richer typed-procedures API, Server Actions give it via direct function types.
2. **Cache + revalidation ergonomics** — TanStack Query's cache, `invalidateQueries`, optimistic mutations are mature; Next.js's `revalidateTag` is newer.
3. **Pagination + infinite scroll** — TanStack Query's `useInfiniteQuery` is best-in-class; doing it on top of Server Actions requires more wiring.
4. **WebSocket / SSE** — neither option ships this directly; both leave room for a separate realtime layer.
5. **Bundle size** — Server Actions add ~zero bytes; tRPC + TanStack Query adds ~12 KB gzipped.
6. **Velocity** — tRPC's `useQuery` / `useMutation` shape is what most TS devs know; Server Actions' transitions + `revalidateTag` is newer and has rougher edges.

## Considered options

### Option A — Server Actions only (recommended)

- One mental model. Every client→server call is a Server Action; reads happen in RSC.
- Native to Next.js App Router; no extra dependency.
- Revalidation via `revalidateTag` + `cache` tagging is sufficient for the surfaces in scope.
- For genuinely complex client-side state (CRM filters, calendar drag-and-drop), reach for a small client-side fetch helper that calls a Server Action and stores results in component state or a Zustand atom.

### Option B — Server Actions + tRPC

- Richer client-side cache and mutation patterns.
- Familiar to teams coming from React Query / SWR.
- Adds a dependency and a routing layer; some duplication with Server Actions.

## Decision (recommended)

**Adopt Option A — Server Actions only for V1.** The reasoning:

- The admin surfaces in scope (CRM queue, repair inbox, calendar, property editor) have moderate interactivity, not extreme. Server Actions + `revalidateTag` is sufficient.
- Adding tRPC means a third "way of fetching" alongside RSC and Server Actions; one mental model is worth more than the ergonomic gain.
- If a specific surface later proves to need tRPC's cache (e.g. an infinite-scroll lead queue with optimistic updates), tRPC can be mounted as a route handler on a `/api/trpc` prefix without revisiting this ADR — it composes cleanly with the rest of the stack.

## Consequences

- A thin `packages/utils/client-fetch.ts` helper wraps `fetch` to Server Action endpoints with optimistic state and error handling.
- Page-level `revalidatePath` / `revalidateTag` calls are documented per epic in the dev briefs.
- Real-time surfaces (e.g. the contractor inbox if a tenant pays for live SLA updates) get a separate SSE / WebSocket route handler, not folded into tRPC.

## Follow-ups before `Accepted`

- Ratify with the platform owner.
- Confirm the optimistic-state pattern (`useOptimistic` vs Zustand atoms) for the CRM queue — recorded here as a sub-note, not a separate ADR.
