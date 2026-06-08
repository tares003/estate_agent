/**
 * G7 — Design-token guard (DESIGN.md: no raw hex / px / ms / easing).
 *
 * Every visual value — colour, spacing, duration, easing — must reference a
 * design token (a CSS custom property such as `var(--colour-brand-primary)`,
 * or a Tailwind token utility such as `bg-brand` / `p-4` / `duration-fast`),
 * never a raw literal. This rule flags raw literals where a token is required.
 *
 * Scope is deliberately narrow to two contexts, to avoid the false positives
 * a blanket "no hex / px / ms anywhere" rule would create against innocent code
 * (timeouts, ports, IDs, fixture data, copy):
 *
 *   (A) string Literal values inside the ObjectExpression that is the value of
 *       a JSX attribute named `style` (i.e. `style={{ ... }}`).
 *   (B) string Literals assigned to a JSX attribute named `className` OR `class`
 *       that contain a Tailwind *arbitrary value* carrying a raw token —
 *       `-[#rrggbb…]` (colour) or `-[16px]` (px). A className with token
 *       utilities (`bg-brand`, `p-4`) or a token var arbitrary value
 *       (`bg-[var(--colour-brand-primary)]`) is clean.
 *
 * One error is reported per distinct violation kind found in the value.
 *
 * NOTE: `packages/tokens` *defines* the tokens, so it is the one place raw
 * literals are legal. That directory is excluded via the ESLint config
 * `ignores` glob — NOT special-cased here — so this rule stays path-agnostic.
 */

/** Raw-colour: a CSS hex colour, 3–8 hex digits. */
const HEX = /#[0-9a-fA-F]{3,8}\b/;
/** Raw-px: a numeric pixel length. */
const PX = /\b[0-9.]+px\b/;
/** Raw-ms: a numeric millisecond duration. */
const MS = /\b[0-9.]+ms\b/;
/** Raw-easing: a cubic-bezier() or a bare CSS easing keyword. */
const EASING = /cubic-bezier\s*\(|\b(?:ease-in-out|ease-in|ease-out|ease|linear)\b/;

/**
 * Strip `var(--token)` references out of a value before scanning. A token
 * reference is the *correct* shape, so its inner text (e.g. `--motion-ease-…`,
 * `--colour-…`) must never be mistaken for a raw `ease`/hex/px literal.
 * @param {string} value
 * @returns {string}
 */
function stripTokenRefs(value) {
  return value.replace(/var\(\s*--[^)]*\)/g, ' ');
}

/** Tailwind arbitrary value carrying a raw hex colour, e.g. `bg-[#1F2937]`. */
const TW_ARBITRARY_HEX = /-\[#[0-9a-fA-F]{3,8}\]/;
/** Tailwind arbitrary value carrying a raw px length, e.g. `p-[16px]`. */
const TW_ARBITRARY_PX = /-\[[0-9.]+px\]/;

/**
 * Inspect a string value for raw colour / px / ms / easing literals and report
 * one error per distinct kind found.
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Node} node node to attach reports to
 * @param {string} value the string value being inspected
 */
function reportRawLiterals(context, node, value) {
  const scanned = stripTokenRefs(value);
  if (HEX.test(scanned)) context.report({ node, messageId: 'rawColor' });
  if (PX.test(scanned)) context.report({ node, messageId: 'rawPx' });
  if (MS.test(scanned)) context.report({ node, messageId: 'rawMs' });
  if (EASING.test(scanned)) context.report({ node, messageId: 'rawEasing' });
}

/**
 * @param {import('estree').Node | null | undefined} node
 * @returns {boolean} true if the node is a string Literal.
 */
function isStringLiteral(node) {
  return Boolean(node) && node.type === 'Literal' && typeof node.value === 'string';
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw colour / px / ms / easing literals in JSX style objects and className arbitrary values — a design token must be used (DESIGN.md).',
    },
    schema: [],
    messages: {
      rawColor:
        'Raw colour literal — use a design token (e.g. var(--colour-brand-primary) or a Tailwind colour utility). DESIGN.md forbids raw hex.',
      rawPx:
        'Raw px length — use a spacing/size token (e.g. var(--space-4) or a Tailwind scale utility). DESIGN.md forbids raw px.',
      rawMs:
        'Raw ms duration — use a motion-duration token (e.g. var(--motion-duration-fast)). motion-spec.md forbids raw ms.',
      rawEasing:
        'Raw easing — use a motion-easing token (e.g. var(--motion-ease-standard)). motion-spec.md forbids raw cubic-bezier()/keyword easings.',
    },
  },
  create(context) {
    return {
      // (A) style={{ ... }} — inspect each string Literal property value.
      JSXAttribute(node) {
        const attrName = node.name && node.name.name;

        // Context (A): the `style` attribute holding an object expression.
        if (
          attrName === 'style' &&
          node.value &&
          node.value.type === 'JSXExpressionContainer' &&
          node.value.expression &&
          node.value.expression.type === 'ObjectExpression'
        ) {
          for (const prop of node.value.expression.properties) {
            if (prop.type === 'Property' && isStringLiteral(prop.value)) {
              reportRawLiterals(context, prop.value, prop.value.value);
            }
          }
          return;
        }

        // Context (B): className / class string Literal with a Tailwind
        // arbitrary value carrying a raw token.
        if (attrName === 'className' || attrName === 'class') {
          const valueNode =
            node.value && node.value.type === 'Literal'
              ? node.value
              : node.value &&
                  node.value.type === 'JSXExpressionContainer' &&
                  isStringLiteral(node.value.expression)
                ? node.value.expression
                : null;
          if (isStringLiteral(valueNode)) {
            const raw = valueNode.value;
            if (TW_ARBITRARY_HEX.test(raw)) {
              context.report({ node: valueNode, messageId: 'rawColor' });
            }
            if (TW_ARBITRARY_PX.test(raw)) {
              context.report({ node: valueNode, messageId: 'rawPx' });
            }
          }
        }
      },
    };
  },
};

export default rule;
