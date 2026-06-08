/**
 * G5 — GDPR-consent guard (CLAUDE.md §2; master spec §S.7).
 *
 * Every form that captures personal data must also capture an explicit consent
 * affirmation. Forms are validated by Zod object schemas (`packages/validators`),
 * so this rule inspects `z.object({ … })` call expressions: if the schema's keys
 * include any personal-data field but no consent key (`gdpr_consent` /
 * `gdprConsent`), the schema is non-compliant and is reported.
 *
 * Scope: only `z.object({ <object literal> })` calls — `z` named object, `object`
 * property. Other object builders (`makeForm.object`, `schema.object`, …) and
 * non-object `z.object` arguments are ignored. Keys are matched on
 * ObjectExpression Property nodes (Identifier or string-literal keys), so spread
 * elements and computed keys are skipped.
 */

/**
 * Personal-data field names (lowercased) that require a consent affirmation.
 * Matched case-insensitively against the schema's declared keys.
 */
const PERSONAL_DATA_KEYS = new Set([
  'email',
  'phone',
  'telephone',
  'mobile',
  'name',
  'firstname',
  'lastname',
  'fullname',
  'address',
  'addressline1',
  'postcode',
  'dob',
  'dateofbirth',
  'nationalinsurance',
]);

/** Consent-affirmation key names (lowercased) that satisfy the requirement. */
const CONSENT_KEYS = new Set(['gdpr_consent', 'gdprconsent']);

/**
 * Read the static key name from an ObjectExpression Property, or null when the
 * key is computed / not a plain Identifier or string literal.
 * @param {import('estree').Property} prop
 * @returns {string | null}
 */
function keyName(prop) {
  if (!prop || prop.type !== 'Property' || prop.computed) return null;
  const key = prop.key;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
}

/**
 * True when the call is `z.object(...)` — a MemberExpression callee whose object
 * is the identifier `z` and whose property is `object` (non-computed).
 * @param {import('estree').CallExpression} node
 */
function isZObjectCall(node) {
  const callee = node.callee;
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'z' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'object'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a GDPR-consent affirmation in any Zod schema that captures personal data (master spec §S.7).',
    },
    schema: [],
    messages: {
      missingConsent:
        'This Zod schema captures personal data but has no consent affirmation — add a `gdpr_consent` (or `gdprConsent`) field. Every personal-data form must capture explicit consent (master spec §S.7).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isZObjectCall(node)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;

        let hasPersonalData = false;
        let hasConsent = false;
        for (const prop of arg.properties) {
          const name = keyName(prop);
          if (name === null) continue;
          const lowered = name.toLowerCase();
          if (PERSONAL_DATA_KEYS.has(lowered)) hasPersonalData = true;
          if (CONSENT_KEYS.has(lowered)) hasConsent = true;
        }

        if (hasPersonalData && !hasConsent) {
          context.report({ node, messageId: 'missingConsent' });
        }
      },
    };
  },
};

export default rule;
