/**
 * G12 — Pack-entitlement guard (CLAUDE.md §9 EPIC-AD / PRODUCT.md §5a).
 *
 * Non-core packs are sold as add-ons. Any code that references a non-core pack
 * slug must gate the capability so it only runs for tenants who have enabled
 * that pack. A file that names a pack-scoped slug but never gates it would ship
 * the feature to every tenant regardless of entitlement — this rule fails
 * closed on that case.
 *
 * Per file (`Program:exit`):
 *   - referencesPackSlug: any string Literal in the file equals one of the
 *     non-core pack slugs below.
 *   - hasGate: the file contains a CallExpression to `requirePack(...)` or
 *     `isPackEnabled(...)`, OR a JSXElement named `RequirePack`, OR a comment
 *     matching /pack:\s*core/ (an explicit always-on declaration).
 *
 * If referencesPackSlug && !hasGate, report once on the Program node. Note that
 * `requirePack('sales_plus')` simultaneously references the slug and provides
 * the gate, so it passes — the gate call's own argument is the reference.
 *
 * Core surfaces (properties, enquiries, etc.) reference no pack slug and so are
 * never flagged. See docs/ci-guards/g12-pack-entitlement.md.
 */

/** Non-core pack slugs (PRODUCT.md §5a). Core capabilities are intentionally absent. */
const NON_CORE_PACK_SLUGS = new Set([
  'sales_plus',
  'new_homes',
  'commercial',
  'business_transfer',
  'care_homes',
  'portal_syndication',
  'calculators',
  'bulk_import',
  'feedback_reviews',
  'live_chat',
  'ai_assistant',
]);

/** Gate helper call names that satisfy the entitlement requirement. */
const GATE_CALLEES = new Set(['requirePack', 'isPackEnabled']);

/** Matches an explicit always-on declaration comment, e.g. `// pack: core`. */
const CORE_DECLARATION = /pack:\s*core/;

/**
 * Resolve the callee identifier name of a CallExpression, whether it is called
 * bare (`requirePack(...)`) or as a member (`entitlement.requirePack(...)`).
 * @param {{ type: string, name?: string, property?: { type: string, name?: string } }} callee
 * @returns {string | undefined}
 */
function calleeName(callee) {
  if (!callee) return undefined;
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    callee.property &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a pack-entitlement gate (requirePack / isPackEnabled / <RequirePack> / `// pack: core`) in any file referencing a non-core pack slug (CLAUDE.md §9 EPIC-AD).',
    },
    schema: [],
    messages: {
      missingPackGate:
        'This file references a non-core pack slug but never gates the capability — add a requirePack(...) / isPackEnabled(...) call, a <RequirePack> element, or an explicit `// pack: core` declaration (CLAUDE.md §9 EPIC-AD / PRODUCT.md §5a).',
    },
  },
  create(context) {
    let referencesPackSlug = false;
    let hasGate = false;

    return {
      Literal(node) {
        if (typeof node.value === 'string' && NON_CORE_PACK_SLUGS.has(node.value)) {
          referencesPackSlug = true;
        }
      },
      CallExpression(node) {
        if (GATE_CALLEES.has(calleeName(node.callee))) hasGate = true;
      },
      JSXElement(node) {
        const opening = node.openingElement;
        if (
          opening &&
          opening.name &&
          opening.name.type === 'JSXIdentifier' &&
          opening.name.name === 'RequirePack'
        ) {
          hasGate = true;
        }
      },
      'Program:exit'(node) {
        if (!hasGate) {
          const sourceCode = context.sourceCode ?? context.getSourceCode();
          hasGate = sourceCode
            .getAllComments()
            .some((comment) => CORE_DECLARATION.test(comment.value));
        }
        if (referencesPackSlug && !hasGate) {
          context.report({ node, messageId: 'missingPackGate' });
        }
      },
    };
  },
};

export default rule;
