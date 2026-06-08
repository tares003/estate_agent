import { defineConfig } from 'vitest/config';

// Vitest config for @estate/config — runs the guard unit tests (ESLint
// RuleTester cases for the custom rules, and pure-function tests for the
// standalone script guards). Coverage is reported here; the hard per-file
// threshold (shared packages = 100% line / 100% branch per _tdd-protocol.md §5)
// is enforced in CI by guard G2 against the PR's touched files.
export default defineConfig({
  test: {
    include: ['plugin/**/*.test.{js,ts}', 'guards/**/*.test.{js,ts}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['plugin/rules/**/*.js', 'guards/**/*.ts'],
      exclude: ['**/*.test.*', '**/fixtures/**', '**/_*.{js,ts}'],
    },
  },
});
