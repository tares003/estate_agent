// Self-lint config for @estate/config's own tooling code (the guard rules,
// the script guards and the runner). This intentionally uses only JS + TS
// recommended — NOT the @estate domain guard rules, which target product code
// (apps/web, packages/ui, …) and are applied by those packages' own configs.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', '.turbo/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
