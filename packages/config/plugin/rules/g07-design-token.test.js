import { it } from 'vitest';
import { makeRuleTester } from './_rule-tester.js';
import rule from './g07-design-token.js';

// G7 — Design-token guard. DESIGN.md forbids raw hex / px / ms / easing in
// visual values: every colour, spacing, duration and easing must reference a
// token (CSS custom property or a Tailwind token utility), never a raw literal.
//
// Scope is deliberately narrow to avoid false positives:
//   (A) string Literal values inside the object passed to a JSX `style` attribute
//       (i.e. style={{ ... }}).
//   (B) string Literals assigned to a JSX `className` / `class` attribute that
//       contain a Tailwind arbitrary value carrying a raw token —
//       `-[#rrggbb]` (colour) or `-[16px]` (px).
//
// NOTE: packages/tokens is the one place raw literals are legal (it *defines*
// the tokens). That directory is excluded via the ESLint config `ignores`
// glob, not by this rule — so the rule itself never special-cases a path.
it('G7 design-token: flags raw hex/px/ms/easing in style + className, allows tokens', () => {
  makeRuleTester().run('@estate/design-token', rule, {
    valid: [
      // (A) style object referencing design tokens — clean
      {
        code: "const x = <div style={{ color:'var(--colour-brand-primary)', padding:'var(--space-4)' }} />;",
      },
      {
        code: "const x = <div style={{ transitionDuration:'var(--motion-duration-fast)', transitionTimingFunction:'var(--motion-ease-standard)' }} />;",
      },
      // (B) className using Tailwind token utilities (not arbitrary values) — clean
      { code: 'const x = <div className="bg-brand p-4" />;' },
      { code: 'const x = <div className="text-ink duration-fast ease-standard" />;' },
      // className arbitrary value that references a token var — clean
      { code: 'const x = <div className="bg-[var(--colour-brand-primary)]" />;' },
      // raw literals OUTSIDE the targeted contexts must NOT trip the rule
      { code: "const brandHex = '#1F2937';" },
      { code: "const duration = '150ms';" },
      { code: 'const x = <div data-token="#1F2937" />;' },
      { code: "const x = <div title='ease-in-out timing' />;" },
      // a non-style object with raw literals is out of scope
      { code: "const config = { color:'#1F2937', padding:'16px' };" },
    ],
    invalid: [
      // (A) style object with raw colour + px + ms + easing → 4 distinct violations
      {
        code: "const x = <div style={{ color:'#1F2937', padding:'16px', transition:'all 150ms ease-in-out' }} />;",
        errors: [
          { messageId: 'rawColor' },
          { messageId: 'rawPx' },
          { messageId: 'rawMs' },
          { messageId: 'rawEasing' },
        ],
      },
      // (B) className arbitrary value with raw hex + raw px → 2 violations
      {
        code: 'const x = <div className="bg-[#1F2937] p-[16px]" />;',
        errors: [{ messageId: 'rawColor' }, { messageId: 'rawPx' }],
      },
      // `class` attribute is treated the same as `className`
      {
        code: 'const x = <div class="text-[#abc]" />;',
        errors: [{ messageId: 'rawColor' }],
      },
      // style object: raw easing keyword on its own
      {
        code: "const x = <div style={{ transitionTimingFunction:'cubic-bezier(0.4, 0, 0.2, 1)' }} />;",
        errors: [{ messageId: 'rawEasing' }],
      },
      // style object: bare easing keyword `linear`
      {
        code: "const x = <div style={{ animationTimingFunction:'linear' }} />;",
        errors: [{ messageId: 'rawEasing' }],
      },
    ],
  });
});
