import { defineConfig } from 'vitest/config';

// Base Vitest preset for Node / TypeScript library packages.
// Coverage reporters include json-summary so guard G2 can read per-file
// line/branch percentages from coverage/coverage-summary.json.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      exclude: ['**/*.test.*', '**/*.spec.*', '**/fixtures/**', '**/dist/**', '**/*.config.*'],
    },
  },
});
