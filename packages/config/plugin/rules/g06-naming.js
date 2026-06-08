/**
 * G6 — Naming guard (PRODUCT.md §2 canonical nouns / §3 forbidden alternatives).
 *
 * Code identifiers must use the canonical estate-agency nouns. This rule flags
 * the genuinely unambiguous forbidden estate-agency jargon when it appears as a
 * segment of a *declared* identifier (function / class / interface / type /
 * enum / variable / property name): `lead(s)`, US-spelling `inquiry/inquiries`,
 * `renter(s)`, `realtor(s)`.
 *
 * Deliberately NOT blanket-matched (too many innocent collisions in real code —
 * `prismaClient`, `warehouse`, `customerAccount`, registered-`Customer`):
 * `house`, `listing`, `client`, `customer`, `account`. Those entity-name cases
 * are enforced structurally instead — code referring to the catalogue entity
 * must use the `Property` type from `@estate/types`, so naming it `Listing`
 * fails the type-check rather than this lint rule. See docs/ci-guards/g6-naming.md.
 *
 * Forbidden nouns remain legal in user-facing string / JSX-text label contexts
 * (e.g. the admin label "Lead"); this rule only inspects identifier names, never
 * string Literals or JSX text.
 */

/** Forbidden lowercase segment -> canonical replacement. */
const FORBIDDEN = new Map([
  ['lead', 'enquiry'],
  ['leads', 'enquiries'],
  ['inquiry', 'enquiry'],
  ['inquiries', 'enquiries'],
  ['renter', 'tenant'],
  ['renters', 'tenants'],
  ['realtor', 'agent'],
  ['realtors', 'agents'],
]);

/**
 * Split an identifier into lowercase word segments, handling camelCase,
 * PascalCase, ACRONYMCase and snake_case.
 * @param {string} name
 * @returns {string[]}
 */
function segments(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {{ name: string } | null | undefined} idNode
 */
function checkIdentifier(context, idNode) {
  if (!idNode || typeof idNode.name !== 'string') return;
  for (const segment of segments(idNode.name)) {
    const canonical = FORBIDDEN.get(segment);
    if (canonical) {
      context.report({
        node: idNode,
        messageId: 'forbiddenNoun',
        data: { name: idNode.name, forbidden: segment, canonical },
      });
      return; // one report per identifier is enough
    }
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow forbidden estate-agency nouns in code identifiers (PRODUCT.md §2/§3).',
    },
    schema: [],
    messages: {
      forbiddenNoun:
        "'{{name}}' uses the forbidden noun '{{forbidden}}' — use '{{canonical}}' instead (PRODUCT.md §2/§3). 'Lead'/'Listing' are permitted only as UI-label strings, never in code.",
    },
  },
  create(context) {
    const check = (node) => checkIdentifier(context, node && node.id);
    const checkKey = (node) => {
      if (node && node.key && node.key.type === 'Identifier' && !node.computed) {
        checkIdentifier(context, node.key);
      }
    };
    return {
      FunctionDeclaration: check,
      TSDeclareFunction: check,
      ClassDeclaration: check,
      TSInterfaceDeclaration: check,
      TSTypeAliasDeclaration: check,
      TSEnumDeclaration: check,
      VariableDeclarator(node) {
        if (node.id && node.id.type === 'Identifier') checkIdentifier(context, node.id);
      },
      Property: checkKey,
      PropertyDefinition: checkKey,
      TSPropertySignature: checkKey,
    };
  },
};

export default rule;
