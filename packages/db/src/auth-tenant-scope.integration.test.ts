import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AuthTenantContextError,
  PrismaClient,
  authTenantScopeExtension,
  runWithAuthTenant,
} from './index.js';

// B78e — the Better Auth tenant-scoping adapter (B78a) against REAL PostgreSQL
// (opt-in: `pnpm --filter @estate/db test:integration`, requires Docker). The unit
// tests prove scopeAuthArgs injects correctly; THIS proves the whole mechanism
// holds end-to-end on a real engine: the auth client connects as a privileged role
// that bypasses RLS (here, the container superuser — the production AUTH_DATABASE_URL
// BYPASSRLS role behaves the same), and the `$extends` hook is the ONLY thing
// keeping tenants apart. It verifies the cross-tenant negatives the B78a adversarial
// review demanded: per-tenant identity (same email in two tenants → two distinct
// users, each resolved correctly), cross-tenant invisibility, and fail-closed when
// no tenant is in context.
//
// (The better-auth HTTP/cookie layer on top — auth.api.signUpEmail / getSession —
// is a further integration step; the isolation it depends on is what this locks.)

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..'); // packages/db

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['ps'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const DOCKER = dockerAvailable();

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const SHARED_EMAIL = 'shared@example.com';

describe.skipIf(!DOCKER)('auth tenant-scope on real Postgres (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let admin: Client;
  let base: PrismaClient;
  // The extension only adds a query hook (same model surface), so the extended
  // client is shape-compatible with PrismaClient for the model accessors we use.
  let authClient: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16').withDatabase('estate_test').start();
    const uri = container.getConnectionUri();

    // Create the full Prisma schema (incl. the auth tables + their tenant FKs) via
    // db push. We deliberately do NOT apply the 0012 RLS-enable migration: the auth
    // adapter connects on a BYPASSRLS role, so isolation must come purely from the
    // $extends hook — which is exactly what this test pins down.
    execFileSync(
      'pnpm',
      ['exec', 'prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: uri },
        stdio: 'ignore',
        shell: process.platform === 'win32',
      },
    );

    // Seed the two tenants the auth rows' tenant FK references.
    admin = new Client({ connectionString: uri });
    await admin.connect();
    await admin.query(
      `INSERT INTO platform_tenants (id, slug, name, created_at, updated_at)
       VALUES ($1,'tenant-a','Tenant A', now(), now()),($2,'tenant-b','Tenant B', now(), now())`,
      [TENANT_A, TENANT_B],
    );

    base = new PrismaClient({ datasources: { db: { url: uri } } });
    authClient = base.$extends(authTenantScopeExtension()) as unknown as PrismaClient;
  });

  afterAll(async () => {
    await base?.$disconnect();
    await admin?.end();
    await container?.stop();
  });

  it('writes the CONTEXT tenant onto a create, overriding any supplied value', async () => {
    // better-auth never supplies tenantId; even a (hostile) supplied value loses to
    // the context tenant — the boundary is unspoofable from the create args.
    const user = await runWithAuthTenant(TENANT_A, () =>
      authClient.user.create({
        data: { email: SHARED_EMAIL, name: 'A User', role: 'agent', tenantId: TENANT_B },
      }),
    );
    expect(user.tenantId).toBe(TENANT_A);
  });

  it('makes one tenant’s user invisible to another (cross-tenant read isolation)', async () => {
    const inA = await runWithAuthTenant(TENANT_A, () =>
      authClient.user.findFirst({ where: { email: SHARED_EMAIL } }),
    );
    expect(inA?.email).toBe(SHARED_EMAIL);
    const inB = await runWithAuthTenant(TENANT_B, () =>
      authClient.user.findFirst({ where: { email: SHARED_EMAIL } }),
    );
    expect(inB).toBeNull();
  });

  it('supports the SAME email in two tenants and resolves each to its own user', async () => {
    const aUser = await runWithAuthTenant(TENANT_A, () =>
      authClient.user.findFirst({ where: { email: SHARED_EMAIL } }),
    );
    // Per-tenant identity: a second user with the same email in tenant B is allowed.
    const bUser = await runWithAuthTenant(TENANT_B, () =>
      authClient.user.create({
        data: { email: SHARED_EMAIL, name: 'B User', role: 'agent', tenantId: TENANT_B },
      }),
    );
    expect(bUser.tenantId).toBe(TENANT_B);
    expect(bUser.id).not.toBe(aUser?.id);

    // The email lookup (the sign-in path) resolves to the RIGHT tenant's user.
    const resolvedInA = await runWithAuthTenant(TENANT_A, () =>
      authClient.user.findFirst({ where: { email: SHARED_EMAIL } }),
    );
    const resolvedInB = await runWithAuthTenant(TENANT_B, () =>
      authClient.user.findFirst({ where: { email: SHARED_EMAIL } }),
    );
    expect(resolvedInA?.id).toBe(aUser?.id);
    expect(resolvedInB?.id).toBe(bUser.id);
  });

  it('FAILS CLOSED when no tenant is in context (never runs unscoped on the bypass conn)', async () => {
    await expect(authClient.user.findFirst({ where: { email: SHARED_EMAIL } })).rejects.toThrow(
      AuthTenantContextError,
    );
  });

  it('rejects any access to a non-auth model through the auth connection', async () => {
    await expect(
      runWithAuthTenant(TENANT_A, () => authClient.platformTenant.findFirst()),
    ).rejects.toThrow(AuthTenantContextError);
  });
});
