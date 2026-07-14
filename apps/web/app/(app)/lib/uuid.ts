// The shape every `[id]` admin route segment must have before it reaches the database.
//
// Each of those ids is a Postgres `uuid` column. Handing Prisma a segment that is not a
// UUID does not return "no such row" — it throws P2023 ("Error creating UUID, invalid
// character"), which surfaces as an unhandled 500. A stale bookmark, a truncated link or
// a probe therefore crashed the route instead of rendering Not Found.
//
// Validating the segment's SHAPE first turns that into the honest answer — a 404 — without
// touching the database at all. It is a well-formedness check, not an authorisation or
// existence one: the route still gates on its RBAC permission first, and a well-formed id
// that names no row still falls through to the same notFound().

/** RFC-4122 canonical form: 8-4-4-4-12 hex digits, case-insensitive. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a syntactically valid UUID — i.e. safe to hand to a uuid column. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
