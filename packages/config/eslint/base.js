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
      '**/generated/**',
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
    },
  },
  // G7 exemption: packages/tokens is the single source of truth where the raw
  // hex / px / ms / easing values legitimately live (ported from the canvas).
  {
    files: ['**/packages/tokens/**'],
    rules: { 'estate/design-token': 'off' },
  },
);
