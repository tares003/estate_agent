// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  loadStaffSession,
  staffSessionFromUser,
  type StaffUserReader,
  type StaffUserRow,
} from './staff-user.js';

function user(over: Partial<StaffUserRow> = {}): StaffUserRow {
  return { id: 'u1', name: 'Sam Staff', email: 'sam@agency.test', role: 'sales_agent', ...over };
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
    expect(staffSessionFromUser(user({ role: 'wizard' })).role).toBe('read_only_auditor');
  });
});

describe('loadStaffSession', () => {
  function reader(row: StaffUserRow | null): StaffUserReader {
    return { user: { findFirst: vi.fn(async () => row) } };
  }

  it('returns the resolved session for an existing user', async () => {
    const session = await loadStaffSession(reader(user()), 'u1');
    expect(session).toEqual({ userId: 'u1', role: 'sales_agent', actor: 'agent:u1' });
  });

  it('returns null when there is no such user in the tenant', async () => {
    expect(await loadStaffSession(reader(null), 'missing')).toBeNull();
  });
});
