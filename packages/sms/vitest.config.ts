import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // resolve.ts is env-reading connection glue (the real `fetch` binding + the
      // TWILIO_* env wiring) — it builds the live backend and is not unit-testable
      // without live credentials. The Twilio request mapping it feeds is fully
      // covered via an injected fake transport in twilio.test.ts. Mirrors the
      // exclusion of @estate/email's transport.ts.
      exclude: ['src/**/*.test.ts', 'src/resolve.ts'],
    },
  },
});
