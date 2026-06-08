/**
 * Staff RBAC role catalogue — EPIC-N auth foundation.
 *
 * This is the **typed default catalogue** for the eight staff roles defined in
 * the master spec §H.1. Each role carries a set of permission strings expressed
 * in canonical-noun form (`<noun>.<verb>`) per PRODUCT.md §2 and CI guard G6.
 *
 * Note (per master spec §H.1): permissions are ultimately stored in a
 * `permissions` table and mapped to roles via `role_permissions`, so a Super
 * Admin can build new roles from the UI at runtime. This catalogue is the
 * authoritative seed/baseline for those tables and the source of truth for
 * compile-time permission checks in code; the runtime role editor layers on top
 * of it. The pure helpers below (`hasPermission`, `requirePermission`) operate
 * over this baseline and are 100% unit-tested with no I/O.
 */

/**
 * The canonical permission catalogue. Every entry is `<canonical_noun>.<verb>`
 * (G6). Verbs: `read` (view), `write` (create/edit/archive), `publish`
 * (workflow-gated publish), `manage` (full control incl. delete/config).
 */
export const PERMISSIONS = [
  // Property catalogue (EPIC-F)
  'property.read',
  'property.write',
  'property.publish',
  // CRM / enquiries (EPIC-I)
  'enquiry.read',
  'enquiry.write',
  // Viewings and valuations
  'viewing_request.read',
  'viewing_request.write',
  'valuation_request.read',
  'valuation_request.write',
  // Repairs (EPIC-G)
  'repair_request.read',
  'repair_request.write',
  'repair_request.manage',
  // Contacts (vendors, landlords, tenants, buyers, applicants)
  'contact.read',
  'contact.write',
  // CMS / editorial content (EPIC-C / EPIC-D)
  'content.read',
  'content.write',
  // Branches (EPIC-S / agency structure)
  'branch.read',
  'branch.manage',
  // Agents / team profiles
  'agent.read',
  'agent.write',
  // Users, roles and authentication records (FR-N-6)
  'user.read',
  'user.manage',
  // Pack entitlement (EPIC-AD) — operator/super-admin capability
  'pack.read',
  'pack.manage',
  // Platform settings and integrations
  'setting.read',
  'setting.manage',
  // Audit log (FR-N-14, compliance review)
  'audit.read',
] as const;

/** A single permission string from {@link PERMISSIONS}. */
export type Permission = (typeof PERMISSIONS)[number];

/**
 * The staff roles, in the order declared by the master spec §H.1. Code
 * identifiers are snake_case (G6); the human label lives on each role entry.
 */
export const STAFF_ROLES = [
  'super_admin',
  'branch_manager',
  'property_manager',
  'sales_agent',
  'lettings_agent',
  'content_editor',
  'repairs_manager',
  'read_only_auditor',
] as const;

/** A staff role identifier from {@link STAFF_ROLES}. */
export type StaffRole = (typeof STAFF_ROLES)[number];

/** The shape of a single role entry in the catalogue. */
export interface RoleDefinition {
  /** Human-readable label for the admin UI (master spec §H.1). */
  readonly label: string;
  /** Short description of the role's scope. */
  readonly scope: string;
  /**
   * Whether two-factor authentication is mandatory for this role (FR-N-2:
   * mandatory for super admin and branch manager).
   */
  readonly requiresTwoFactor: boolean;
  /** The permissions this role grants. */
  readonly permissions: readonly Permission[];
}

/** Every read permission — the Read-only Auditor's full grant (§H.1). */
const READ_ONLY: readonly Permission[] = PERMISSIONS.filter((permission) =>
  permission.endsWith('.read'),
);

export const ROLES: Readonly<Record<StaffRole, RoleDefinition>> = {
  // Global. All CRUD on all data + user management + settings + integrations +
  // audit log. Holds every permission in the catalogue.
  super_admin: {
    label: 'Super Admin',
    scope: 'Global',
    requiresTwoFactor: true,
    permissions: [...PERMISSIONS],
  },
  // Their branch(es). All branch-scoped CRUD on properties, leads, repairs; can
  // manage branch agents; cannot manage other branches. (Branch scoping itself
  // is enforced at the data layer via RLS; this catalogue gates the capability.)
  branch_manager: {
    label: 'Branch Manager',
    scope: 'Their branch(es)',
    requiresTwoFactor: true,
    permissions: [
      'property.read',
      'property.write',
      'property.publish',
      'enquiry.read',
      'enquiry.write',
      'viewing_request.read',
      'viewing_request.write',
      'valuation_request.read',
      'valuation_request.write',
      'repair_request.read',
      'repair_request.write',
      'repair_request.manage',
      'contact.read',
      'contact.write',
      'agent.read',
      'agent.write',
      'branch.read',
      'audit.read',
    ],
  },
  // Their assigned properties. CRUD on assigned properties; manage leads for
  // their properties; manage repairs; cannot touch CMS.
  property_manager: {
    label: 'Property Manager',
    scope: 'Their assigned properties',
    requiresTwoFactor: false,
    permissions: [
      'property.read',
      'property.write',
      'enquiry.read',
      'enquiry.write',
      'viewing_request.read',
      'viewing_request.write',
      'repair_request.read',
      'repair_request.write',
      'repair_request.manage',
      'contact.read',
      'contact.write',
    ],
  },
  // Sales funnel. Create / edit sales properties; manage own leads; book
  // viewings; cannot publish (workflow gates).
  sales_agent: {
    label: 'Sales Agent',
    scope: 'Sales funnel',
    requiresTwoFactor: false,
    permissions: [
      'property.read',
      'property.write',
      'enquiry.read',
      'enquiry.write',
      'viewing_request.read',
      'viewing_request.write',
      'valuation_request.read',
      'valuation_request.write',
      'contact.read',
      'contact.write',
    ],
  },
  // Lettings funnel. Create / edit rental properties; manage own leads; book
  // viewings; manage repair triage.
  lettings_agent: {
    label: 'Lettings Agent',
    scope: 'Lettings funnel',
    requiresTwoFactor: false,
    permissions: [
      'property.read',
      'property.write',
      'enquiry.read',
      'enquiry.write',
      'viewing_request.read',
      'viewing_request.write',
      'repair_request.read',
      'repair_request.write',
      'contact.read',
      'contact.write',
    ],
  },
  // CMS only. Pages, sections, blog, area guides, team profiles, FAQs,
  // testimonials, menus, footer, SEO.
  content_editor: {
    label: 'Content Editor',
    scope: 'CMS only',
    requiresTwoFactor: false,
    permissions: ['content.read', 'content.write', 'agent.read', 'agent.write'],
  },
  // Repairs only. Manage all repair tickets, contractors, repair categories;
  // cannot touch properties.
  repairs_manager: {
    label: 'Repairs Manager',
    scope: 'Repairs only',
    requiresTwoFactor: false,
    permissions: [
      'repair_request.read',
      'repair_request.write',
      'repair_request.manage',
      'contact.read',
    ],
  },
  // Global, read-only. View everything for compliance review; cannot edit.
  read_only_auditor: {
    label: 'Read-only Auditor',
    scope: 'Global, read-only',
    requiresTwoFactor: false,
    permissions: READ_ONLY,
  },
};

/**
 * Error thrown by {@link requirePermission} when a role lacks a permission.
 * Carries the offending `role` and `permission` for structured handling and
 * audit logging.
 */
export class PermissionError extends Error {
  override readonly name = 'PermissionError';
  readonly role: string;
  readonly permission: string;

  constructor(role: string, permission: string) {
    super(`Role "${role}" does not have permission "${permission}".`);
    this.role = role;
    this.permission = permission;
  }
}

/**
 * Pure predicate: does `role` grant `permission`? Returns `false` for an
 * unknown role or an unknown permission (fail-closed) rather than throwing.
 */
export function hasPermission(role: StaffRole, permission: Permission): boolean {
  const definition = ROLES[role] as RoleDefinition | undefined;
  if (definition === undefined) return false;
  return definition.permissions.includes(permission);
}

/**
 * Assert that `role` grants `permission`. Throws {@link PermissionError} if it
 * does not (or if the role is unknown). Use at the top of any state-changing
 * capability to enforce FR-N-6.
 */
export function requirePermission(role: StaffRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionError(role, permission);
  }
}
