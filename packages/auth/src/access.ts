/**
 * Higher-level pure access helpers built on the {@link ROLES} catalogue. These
 * exist so feature code asks an intention-revealing question ("can this role
 * manage packs?") instead of restating the underlying permission string at
 * every call site. All are pure and fully unit-tested.
 */

import { ROLES, STAFF_ROLES, hasPermission, type Permission, type StaffRole } from './roles.js';

/**
 * The operator scope. Per CLAUDE.md §9 the platform operator admin spans
 * tenants and is not itself a tenant; within a tenant, the `super_admin` is the
 * role that carries operator-grade authority (full data + users + settings +
 * packs + audit). This predicate identifies that role.
 */
export function isOperator(role: StaffRole): boolean {
  return role === 'super_admin';
}

/** Can this role enable/disable feature packs (EPIC-AD)? */
export function canManagePacks(role: StaffRole): boolean {
  return hasPermission(role, 'pack.manage');
}

/** Can this role manage users, roles and authentication records (FR-N-6)? */
export function canManageUsers(role: StaffRole): boolean {
  return hasPermission(role, 'user.manage');
}

/** Is this the global read-only compliance auditor role (§H.1)? */
export function isAuditor(role: StaffRole): boolean {
  return role === 'read_only_auditor';
}

/**
 * Every staff role that grants `permission`, in catalogue order. Returns an
 * empty array for an unknown permission. Useful for building the role-editor UI
 * and for audit-coverage assertions.
 */
export function rolesWithPermission(permission: Permission): StaffRole[] {
  return STAFF_ROLES.filter((role) => ROLES[role].permissions.includes(permission));
}
