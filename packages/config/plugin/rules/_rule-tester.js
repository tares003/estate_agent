// Shared ESLint RuleTester factory for the @estate guard rules.
//
// Every custom-rule guard test (G4, G5, G6, G7, G8, G12) instantiates the
// tester through this factory so the parser + language options are configured
// identically — TypeScript syntax and JSX both parse, because the rules run
// against .ts and .tsx product code.
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

/** @returns {RuleTester} a RuleTester wired for TS + JSX (ESLint flat config). */
export function makeRuleTester() {
  return new RuleTester({
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  });
}
