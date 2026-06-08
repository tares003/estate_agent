// Shared ESLint flat config for React/JSX surfaces (apps/web, packages/ui).
// Extends the base config and enables JSX parsing + the React / hooks / a11y
// plugins. The @estate JSX-aware guards (G7 design-token, G8 trust-marker,
// G12 pack-entitlement) come from the base config and need the JSX parsing
// turned on here to fire on .tsx product code.
import base from './base.js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  ...base,
  {
    files: ['**/*.{jsx,tsx}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...(react.configs?.flat?.recommended?.rules ?? {}),
      ...(reactHooks.configs?.recommended?.rules ?? {}),
      ...(jsxA11y.flatConfigs?.recommended?.rules ?? {}),
      // Next.js / React 17+ automatic runtime — no in-scope React import needed.
      'react/react-in-jsx-scope': 'off',
    },
  },
];
