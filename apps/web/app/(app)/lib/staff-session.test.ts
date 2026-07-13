// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Audit findings staff-dev-fallback-not-env-gated + admin-read-*-gate: the staff
// session seam must FAIL CLOSED in production. An unauthenticated request (no
// verified Better Auth cookie, no configured dev user) must resolve to NO staff
// session — never to the DEV super-admin fallback — so requireStaffPermission
// denies every gated read/write. Outside production the fallback keeps local dev
// exercisable without sign-in. The seam is glue (coverage-excluded); these tests
// pin its security-bearing resolution order with the collaborators mocked.

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('./tenant.js', () => ({
  getCurrentTenantId: async () => '00000000-0000-0000-0000-000000000001',
}));
vi.mock('./db.js', () => ({ getDb: () => ({}) }));

const getAuth = vi.fn();
vi.mock('./auth.js', () => ({ getAuth: () => getAuth() }));

const findFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ user: { findFirst } }),
  runWithAuthTenant: async (_t: string, fn: () => unknown) => fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getAuth.mockReturnValue(null);
  findFirst.mockResolvedValue(null);
  delete process.env['DEV_STAFF_USER_ID'];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function seam() {
  return import('./staff-session.js');
}

describe('getStaffSession', () => {
  it('fails CLOSED in production: no verified session and no dev user resolves to null', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getStaffSession } = await seam();
    expect(await getStaffSession()).toBeNull();
  });

  it('falls back to the dev super-admin OUTSIDE production only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { getStaffSession } = await seam();
    const session = await getStaffSession();
    expect(session).toEqual({ userId: null, role: 'super_admin', actor: 'agent:dev-staff' });
  });

  it('still resolves a configured DEV_STAFF_USER_ID staff user in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV_STAFF_USER_ID', 'u1');
    findFirst.mockResolvedValue({
      id: 'u1',
      name: 'Sam Staff',
      email: 'sam@agency.test',
      role: 'branch_manager',
      type: 'staff',
    });
    const { getStaffSession } = await seam();
    const session = await getStaffSession();
    expect(session).toMatchObject({ userId: 'u1', role: 'branch_manager' });
  });
});

describe('requireStaffPermission', () => {
  it('DENIES every permission in production when no staff session resolves', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { requireStaffPermission } = await seam();
    await expect(requireStaffPermission('audit.read')).rejects.toThrow();
    await expect(requireStaffPermission('property.write')).rejects.toThrow();
  });

  it('grants via the dev fallback outside production (local dev stays exercisable)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { requireStaffPermission } = await seam();
    await expect(requireStaffPermission('audit.read')).resolves.toBeUndefined();
  });
});

describe('getStaffActor', () => {
  it('throws in production when unauthenticated (never mints a dev actor)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getStaffActor } = await seam();
    await expect(getStaffActor()).rejects.toThrow();
  });
});
