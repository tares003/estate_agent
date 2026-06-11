import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // index.ts is the BullMQ/Redis/Prisma connection entrypoint and
      // payload-email-settings.ts is the raw-SQL + live-decrypt mailer binding —
      // both are connection glue that cannot run without live Redis / Postgres /
      // an encryption key, mirroring the exclusion of @estate/email's
      // transport.ts and @estate/db's client.ts. Every decision they wire
      // (dispatch order, claim idempotency, finalize + audit, template render)
      // is fully covered via injected fakes in the dispatcher/template tests.
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/payload-email-settings.ts'],
    },
  },
});
