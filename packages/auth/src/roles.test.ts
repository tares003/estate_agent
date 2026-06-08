import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  PermissionError,
  ROLES,
  STAFF_ROLES,
  hasPermission,
  requirePermission,
  type Permission,
  type StaffRole,
} from './roles.js';

describe('PERMISSIONS catalogue', () => {
  it('every permission is a canonical "<noun>.<verb>" string (G6)', () => {
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('has no duplicate permission strings', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('includes the capabilities named in the brief and EPIC-N', () => {
    const expected: Permission[] = [
      'property.write',
      'enquiry.read',
      'pack.manage',
      'user.manage',
      'audit.read',
    ];
    for (const permission of expected) {
      expect(PERMISSIONS).toContain(permission);
    }
  });
});

describe('ROLES catalogue (master spec §H.1)', () => {
  it('defines every staff role from the spec', () => {
    expect(STAFF_ROLES).toEqual([
      'super_admin',
      'branch_manager',
      'property_manager',
      'sales_agent',
      'lettings_agent',
      'content_editor',
      'repairs_manager',
      'read_only_auditor',
    ]);
  });

  it('keys the ROLES record by exactly the staff-role list', () => {
    expect(Object.keys(ROLES).sort()).toEqual([...STAFF_ROLES].sort());
  });

  it('gives every role a non-empty, deduplicated, valid permission set', () => {
    for (const role of STAFF_ROLES) {
      const perms = ROLES[role].permissions;
      expect(perms.length).toBeGreaterThan(0);
      expect(new Set(perms).size).toBe(perms.length);
      for (const p of perms) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });

  it('carries the role label and the mandatory-2FA flag (FR-N-2)', () => {
    for (const role of STAFF_ROLES) {
      expect(typeof ROLES[role].label).toBe('string');
      expect(ROLES[role].label.length).toBeGreaterThan(0);
      expect(typeof ROLES[role].requiresTwoFactor).toBe('boolean');
    }
  });

  it('mandates 2FA for super_admin and branch_manager only (FR-N-2)', () => {
    expect(ROLES.super_admin.requiresTwoFactor).toBe(true);
    expect(ROLES.branch_manager.requiresTwoFactor).toBe(true);
    expect(ROLES.sales_agent.requiresTwoFactor).toBe(false);
    expect(ROLES.content_editor.requiresTwoFactor).toBe(false);
    expect(ROLES.read_only_auditor.requiresTwoFactor).toBe(false);
  });

  it('super_admin holds every permission in the catalogue', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('super_admin', permission)).toBe(true);
    }
  });

  it('read_only_auditor holds only read permissions (cannot edit)', () => {
    for (const permission of ROLES.read_only_auditor.permissions) {
      expect(permission.endsWith('.read')).toBe(true);
    }
  });

  it('content_editor cannot touch properties or repairs', () => {
    expect(hasPermission('content_editor', 'property.write')).toBe(false);
    expect(hasPermission('content_editor', 'repair_request.write')).toBe(false);
    expect(hasPermission('content_editor', 'content.write')).toBe(true);
  });

  it('repairs_manager manages repairs but not properties', () => {
    expect(hasPermission('repairs_manager', 'repair_request.write')).toBe(true);
    expect(hasPermission('repairs_manager', 'property.write')).toBe(false);
  });
});

describe('hasPermission', () => {
  it('returns true when the role grants the permission', () => {
    expect(hasPermission('branch_manager', 'property.write')).toBe(true);
  });

  it('returns false when the role lacks the permission', () => {
    expect(hasPermission('sales_agent', 'user.manage')).toBe(false);
  });

  it('returns false for an unknown role', () => {
    expect(hasPermission('ceo' as StaffRole, 'property.write')).toBe(false);
  });

  it('returns false for an unknown permission', () => {
    expect(hasPermission('super_admin', 'property.teleport' as Permission)).toBe(false);
  });
});

describe('requirePermission', () => {
  it('does not throw when the role grants the permission', () => {
    expect(() => {
      requirePermission('super_admin', 'audit.read');
    }).not.toThrow();
  });

  it('throws a PermissionError when the role lacks the permission', () => {
    expect(() => {
      requirePermission('sales_agent', 'user.manage');
    }).toThrow(PermissionError);
  });

  it('throws for an unknown role', () => {
    expect(() => {
      requirePermission('ghost' as StaffRole, 'audit.read');
    }).toThrow(PermissionError);
  });

  it('the thrown error records the offending role and permission', () => {
    try {
      requirePermission('content_editor', 'property.write');
      expect.unreachable('requirePermission should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionError);
      const permissionError = error as PermissionError;
      expect(permissionError.role).toBe('content_editor');
      expect(permissionError.permission).toBe('property.write');
      expect(permissionError.name).toBe('PermissionError');
      expect(permissionError.message).toContain('content_editor');
      expect(permissionError.message).toContain('property.write');
    }
  });
});
