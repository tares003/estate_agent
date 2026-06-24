import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The app's tsconfig uses jsx: "preserve" (Next compiles JSX itself), so Vitest
// needs the React plugin to transform JSX (automatic runtime) for tests.
export default defineConfig({
  plugins: [react()],
  test: {
    css: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    include: [
      'app/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'payload/**/*.test.{ts,tsx}',
      'proxy.test.{ts,tsx}',
      'security-headers.test.{ts,tsx}',
      'tenant-host.test.{ts,tsx}',
    ],
    // Integration tests (real Postgres + PostGIS via Testcontainers) are opt-in —
    // `pnpm test:integration`; kept out of the fast, Docker-free unit run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'payload/**/*.{ts,tsx}',
        'proxy.ts',
        'tenant-host.ts',
      ],
      exclude: [
        'app/**/*.test.{ts,tsx}',
        'payload/**/*.test.{ts,tsx}',
        'app/**/layout.tsx',
        // Request/connection glue (Prisma + Payload client construction) —
        // exercised via integration/e2e + runtime smoke, not unit tests
        // (constructing the clients pulls server-only/heavy deps into jsdom).
        'app/**/lib/db.ts',
        'app/**/lib/cms.ts',
        // Staff-session seam: a dev stub today, wired to Better Auth in EPIC-N
        // (reads the session). Glue — callers mock it; the RBAC logic lives in
        // @estate/auth.
        'app/**/lib/staff-session.ts',
        // Better Auth composition (B78b): getAuth() reads env + builds the
        // better-auth instance against the BYPASSRLS auth client; auth-db.ts is the
        // `new PrismaClient(AUTH_DATABASE_URL).$extends(...)` connection. Both are
        // env/connection glue — verified by the Testcontainers integration tests
        // (B78e). The pure magic-link mapping (magic-link.ts) stays covered.
        'app/**/lib/auth.ts',
        'app/**/lib/auth-db.ts',
        // The Better Auth catch-all route (B78c): its configured branch is
        // `auth.handler` against a live DB — integration-tested (B78e). Its
        // fail-soft 404 (unconfigured) IS unit-tested in route.test.ts; the file is
        // coverage-excluded because the live-handler branch can't run without a DB.
        'app/**/api/auth/**',
        // Per-tenant Mailer resolver: Payload Local API + decrypt → NodemailerMailer
        // (glue); the crypto + field logic are unit-tested in @estate/email +
        // payload/fields/secret-field.ts.
        'app/**/lib/tenant-mailer.ts',
        // The async public header fetches the CMS menu (Payload Local API) — glue,
        // verified by runtime smoke; its pure mapper (menu-mapper.ts) + SiteNav are
        // unit-tested.
        'components/SiteHeader.tsx',
        // The property_grid renderer fetches the catalogue (Prisma) at render —
        // glue, verified by build/e2e; its pure config->options mapping
        // (property-grid-options.ts) is unit-tested.
        'components/blocks/PropertyGridBlock.tsx',
        // The CMS editorial catch-all is thin fetch+render glue, verified by the
        // runtime smoke; its pure mapper (cms-mapper.ts) is unit-tested.
        'app/**/[[]...slug[]]/**',
        // The send-test endpoint handler is Payload request glue (auth + Local API
        // + dynamic-imported Mailer/Lexical); verified by build/smoke. Its testable
        // mapping lives in app/(app)/lib/email-template.ts + @estate/email.
        'payload/endpoints/**',
        // The Payload mount's framework glue (route group + handlers) is verified
        // by `next build` + a runtime smoke, not unit coverage — same rationale as
        // layout.tsx / db.ts above. The testable config (collections, cms-config)
        // stays in coverage via the cms-mount contract test.
        'app/(payload)/**',
        '**/*.config.*',
      ],
    },
  },
});
