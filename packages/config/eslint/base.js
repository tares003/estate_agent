// Shared base ESLint flat config for TypeScript packages in the monorepo.
// JS + TS recommended, plus the six @estate AST-level CI guard rules.
// React/JSX surfaces extend this via ./react.js.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import estate from '../plugin/index.js';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/generated/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { estate },
    rules: {
      'estate/audit-log-coverage': 'error',
      'estate/gdpr-consent': 'error',
      'estate/naming': 'error',
      'estate/design-token': 'error',
      'estate/trust-marker': 'error',
      'estate/pack-entitlement': 'error',
      // Align with tsconfig's noUnusedParameters/noUnusedLocals, which ignore
      // `_`-prefixed identifiers — used for intentionally-unused args (e.g. a
      // forward-looking signature param) and ignored catch bindings.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // G7 exemption: packages/tokens is the single source of truth where the raw
  // hex / px / ms / easing values legitimately live (ported from the canvas).
  {
    files: ['**/packages/tokens/**'],
    rules: { 'estate/design-token': 'off' },
  },
  // The capability-oriented guards target runtime capabilities/surfaces, not
  // tests: a test legitimately references pack slugs, prices and `'use server'`
  // mutations as fixtures. Naming (G6), design-token (G7) and gdpr-consent (G5)
  // still apply to test files.
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    rules: {
      'estate/audit-log-coverage': 'off',
      'estate/trust-marker': 'off',
      'estate/pack-entitlement': 'off',
    },
  },
);
