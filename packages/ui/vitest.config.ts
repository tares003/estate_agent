import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `css: false` makes `.css` imports inert in tests — the component imports its
  // co-located stylesheet for the real build, but jsdom never applies it, so the
  // unit tests assert structure/behaviour/classes, not computed style.
  css: false,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test-setup.ts',
        // Pure re-export barrels (the package entry + per-component index.ts)
        // carry no executable logic; the components they re-export are covered.
        'src/index.ts',
        'src/**/index.ts',
      ],
    },
  },
});
