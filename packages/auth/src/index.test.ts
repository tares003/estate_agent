import { describe, expect, it } from 'vitest';

import * as auth from './index.js';

describe('@estate/auth barrel', () => {
  it('exports the RBAC catalogue and permission helpers', () => {
    expect(Array.isArray(auth.PERMISSIONS)).toBe(true);
    expect(Array.isArray(auth.STAFF_ROLES)).toBe(true);
    expect(typeof auth.ROLES).toBe('object');
    expect(typeof auth.hasPermission).toBe('function');
    expect(typeof auth.requirePermission).toBe('function');
    expect(typeof auth.PermissionError).toBe('function');
  });

  it('exports the access helpers', () => {
    expect(typeof auth.isOperator).toBe('function');
    expect(typeof auth.canManagePacks).toBe('function');
    expect(typeof auth.canManageUsers).toBe('function');
    expect(typeof auth.isAuditor).toBe('function');
    expect(typeof auth.rolesWithPermission).toBe('function');
  });

  it('exports the auth-config factory', () => {
    expect(typeof auth.createAuth).toBe('function');
  });
});
