/**
 * @estate/auth — EPIC-N auth foundation.
 *
 * Public surface:
 *   - The staff RBAC role catalogue and permission helpers (`ROLES`,
 *     `PERMISSIONS`, `hasPermission`, `requirePermission`, `PermissionError`).
 *   - Higher-level access predicates (`isOperator`, `canManagePacks`, …).
 *   - The `createAuth` Better Auth configuration factory.
 *   - The public types for all of the above.
 */

export {
  PERMISSIONS,
  PermissionError,
  ROLES,
  STAFF_ROLES,
  hasPermission,
  requirePermission,
  type Permission,
  type RoleDefinition,
  type StaffRole,
} from './roles.js';

export {
  canManagePacks,
  canManageUsers,
  isAuditor,
  isOperator,
  rolesWithPermission,
} from './access.js';

export {
  createAuth,
  type Auth,
  type CreateAuthOptions,
  type SocialProviderCredentials,
} from './auth.js';
