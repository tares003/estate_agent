import type { Access, Field, FieldHook, PayloadRequest, Where } from 'payload';

// Per-tenant isolation for Payload-managed (payload-schema) collections.
//
// Payload runs its own DB connection via Drizzle, so the Prisma tenant-RLS
// extension (which issues SET LOCAL app.current_tenant_id) does NOT cover
// Payload's queries. Isolation is therefore enforced at the application layer by
// these access functions + the tenant field, reading the x-estate-tenant header
// the proxy sets per request. The proxy resolves the tenant server-side and
// OVERWRITES any client-supplied value, so the header is not client-forgeable
// (proxy.ts / resolveTenantId); full hostname-based resolution lands with EPIC-S.
// Here we consume the resolved value and FAIL CLOSED if it is missing.
//
// Auth-collection (cms_users) tenant scoping is deferred to the EPIC-N auth
// integration — it interacts with login, first-user bootstrap, and per-tenant
// email uniqueness, which need handling beyond a content-collection filter.

/** The request header the proxy sets to the resolved platform tenant id. */
export const TENANT_HEADER = 'x-estate-tenant';

/** Read the resolved tenant id from a request, or null when unresolved. */
export function getTenantFromReq(req: Pick<PayloadRequest, 'headers'>): string | null {
  const value = req.headers?.get(TENANT_HEADER) ?? null;
  return value && value.length > 0 ? value : null;
}

/**
 * Read / update / delete access: constrain the operation to rows owned by the
 * request's tenant via a Where filter. Denies (false) when no tenant is
 * resolved — fail closed, never fall through to all tenants.
 */
export const tenantScopedAccess: Access = ({ req }) => {
  const tenantId = getTenantFromReq(req);
  if (!tenantId) {
    return false;
  }
  const where: Where = { tenant: { equals: tenantId } };
  return where;
};

/**
 * Create access: only an authenticated editor with a resolved tenant may create.
 * The tenant value itself is stamped by `stampTenant`, not taken from input.
 */
export const tenantCreateAccess: Access = ({ req }) =>
  Boolean(req.user) && getTenantFromReq(req) !== null;

/**
 * Field hook that stamps the request tenant onto the row at create time and
 * makes it immutable thereafter (an update keeps the stored value, ignoring any
 * client-supplied tenant). Runs in beforeValidate so the required check sees it.
 * FAIL CLOSED: on create the tenant comes ONLY from the request — never from the
 * client-supplied `value`. When unresolved it returns undefined, tripping the
 * field's `required` validation rather than honouring attacker/seed input.
 */
export const stampTenant: FieldHook = ({ req, value, operation }) => {
  if (operation === 'create') {
    return getTenantFromReq(req) ?? undefined;
  }
  return value;
};

/**
 * The owning-tenant field for a tenant-scoped collection: required, indexed,
 * read-only in the admin, auto-stamped from the request, and never updatable via
 * the API.
 */
export const tenantField: Field = {
  name: 'tenant',
  type: 'text',
  required: true,
  index: true,
  access: {
    update: () => false,
  },
  admin: {
    readOnly: true,
    position: 'sidebar',
    description: 'Owning platform tenant — set automatically from the request.',
  },
  hooks: {
    beforeValidate: [stampTenant],
  },
};
