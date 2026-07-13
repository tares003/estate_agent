// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  loadStaffSession,
  staffSessionFromUser,
  type StaffUserReader,
  type StaffUserRow,
} from './staff-user.js';

function user(over: Partial<StaffUserRow> = {}): StaffUserRow {
  return {
    id: 'u1',
    name: 'Sam Staff',
    email: 'sam@agency.test',
    role: 'sales_agent',
    type: 'staff',
    ...over,
  };
}

describe('staffSessionFromUser', () => {
  it('resolves a valid role + the audit actor', () => {
    expect(staffSessionFromUser(user({ id: 'u9', role: 'branch_manager' }))).toEqual({
      userId: 'u9',
      role: 'branch_manager',
      actor: 'agent:u9',
    });
  });

  it('fails safe to least privilege for an unrecognised role (no escalation)', () => {
    expect(staffSessionFromUser(user({ role: 'wizard' }))?.role).toBe('read_only_auditor');
  });

  // Audit finding staff-seam-missing-customer-type-check: a `type=customer` user
  // must NEVER resolve to a staff session — mirroring the customer seam, which
  // rejects staff rows (customer-user.ts). Without this gate a signed-in customer
  // maps to read_only_auditor and passes every `.read` RBAC check.
  it('REJECTS a customer-type user (a customer identity never becomes staff)', () => {
    expect(staffSessionFromUser(user({ type: 'customer' }))).toBeNull();
  });

  it('REJECTS any non-staff type (fail-closed on unknown types)', () => {
    expect(staffSessionFromUser(user({ type: 'contractor' }))).toBeNull();
    expect(staffSessionFromUser(user({ type: '' }))).toBeNull();
  });
});

describe('loadStaffSession', () => {
  function reader(row: StaffUserRow | null): { db: StaffUserReader; findFirst: ReturnType<typeof vi.fn> } {
    const findFirst = vi.fn(async () => row);
    return { db: { user: { findFirst } }, findFirst };
  }

  it('returns the resolved session for an existing staff user', async () => {
    const { db } = reader(user());
    const session = await loadStaffSession(db, 'u1');
    expect(session).toEqual({ userId: 'u1', role: 'sales_agent', actor: 'agent:u1' });
  });

  it('restricts the lookup to staff rows (the WHERE carries the type filter)', async () => {
    const { db, findFirst } = reader(user());
    await loadStaffSession(db, 'u1');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'u1', type: 'staff' } });
  });

  it('returns null for a customer-type row even if the read returns one', async () => {
    const { db } = reader(user({ type: 'customer' }));
    expect(await loadStaffSession(db, 'u1')).toBeNull();
  });

  it('returns null when there is no such user in the tenant', async () => {
    const { db } = reader(null);
    expect(await loadStaffSession(db, 'missing')).toBeNull();
  });
});
