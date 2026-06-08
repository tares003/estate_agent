import { defineConfig } from 'vitest/config';

// Vitest preset for React component packages (packages/ui, apps/web component
// tests): jsdom environment + globals. Component packages add their own
// setupFiles (e.g. @testing-library/jest-dom) on top of this.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      exclude: ['**/*.test.*', '**/*.spec.*', '**/fixtures/**', '**/dist/**', '**/*.config.*'],
    },
  },
});
