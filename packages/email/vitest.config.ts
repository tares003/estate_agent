import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // transport.ts is the `nodemailer.createTransport()` connection glue — a
      // single statement that builds a real SMTP transport. It is not unit-
      // testable without a live SMTP server; the send mapping it feeds is fully
      // covered via an injected fake transport in mailer.test.ts. Mirrors the
      // exclusion of @estate/db's client.ts (the `new PrismaClient()` glue).
      exclude: ['src/**/*.test.ts', 'src/transport.ts'],
    },
  },
});
