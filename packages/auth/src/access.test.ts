import { describe, expect, it } from 'vitest';

import {
  canManagePacks,
  canManageUsers,
  isAuditor,
  isOperator,
  rolesWithPermission,
} from './access.js';
import { STAFF_ROLES, type StaffRole } from './roles.js';

describe('isOperator', () => {
  it('treats super_admin as the operator-scope role', () => {
    expect(isOperator('super_admin')).toBe(true);
  });

  it('is false for every non-super-admin staff role', () => {
    for (const role of STAFF_ROLES.filter((r) => r !== 'super_admin')) {
      expect(isOperator(role)).toBe(false);
    }
  });

  it('is false for an unknown role', () => {
    expect(isOperator('intern' as StaffRole)).toBe(false);
  });
});

describe('canManagePacks (EPIC-AD entitlement, operator capability)', () => {
  it('is true only when the role holds pack.manage', () => {
    expect(canManagePacks('super_admin')).toBe(true);
    expect(canManagePacks('branch_manager')).toBe(false);
    expect(canManagePacks('content_editor')).toBe(false);
  });

  it('is false for an unknown role', () => {
    expect(canManagePacks('nobody' as StaffRole)).toBe(false);
  });
});

describe('canManageUsers', () => {
  it('is true only when the role holds user.manage', () => {
    expect(canManageUsers('super_admin')).toBe(true);
    expect(canManageUsers('sales_agent')).toBe(false);
  });
});

describe('isAuditor', () => {
  it('is true for the read-only auditor role', () => {
    expect(isAuditor('read_only_auditor')).toBe(true);
  });

  it('is false for other roles', () => {
    expect(isAuditor('super_admin')).toBe(false);
    expect(isAuditor('branch_manager')).toBe(false);
  });
});

describe('rolesWithPermission', () => {
  it('returns every role that grants the given permission', () => {
    const writers = rolesWithPermission('property.write');
    expect(writers).toContain('super_admin');
    expect(writers).toContain('branch_manager');
    expect(writers).not.toContain('content_editor');
  });

  it('returns an empty array for an unknown permission', () => {
    expect(rolesWithPermission('property.fly' as never)).toEqual([]);
  });

  it('audit.read is granted to the auditor and the super admin at least', () => {
    const readers = rolesWithPermission('audit.read');
    expect(readers).toContain('read_only_auditor');
    expect(readers).toContain('super_admin');
  });
});
