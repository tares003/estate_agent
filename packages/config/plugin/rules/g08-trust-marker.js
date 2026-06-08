/**
 * G8 — Trust-marker guard.
 *
 * A bare rent / price figure rendered directly inside a host JSX element must
 * carry an adjacent frequency / qualifier marker. A price with no frequency
 * ("£1,200" — per week? per month? per annum?) is misleading to the customer
 * and undermines the trust requirement; the agency must always state the basis.
 *
 * HEURISTIC: this rule is deliberately heuristic. It matches a fixed set of
 * targeted member-property names (rent / rentPcm / rentPw / rentPa / price) and
 * scans sibling JSX text / string children for a frequency marker via regex. It
 * does NOT — and cannot — reason about values resolved at runtime, markers
 * pulled from variables, or figures rendered by nested components. It catches
 * the common bare-figure-in-a-host-tag mistake; semantic edge cases are left to
 * review. False negatives are accepted; the intent is a cheap, fail-closed nudge
 * at the obvious call sites.
 *
 * Trigger: a JSXElement whose name is one of the lowercase host tags below, that
 * contains — among its children — a JSXExpressionContainer whose expression
 * references a targeted MemberExpression (either the member directly, or a
 * CallExpression such as `formatGBP(property.rentPcm)` wrapping it). For such an
 * element, SOME descendant JSXText or string literal in the same element must
 * match the frequency / qualifier regex. If none does, report on the element.
 *
 * A dedicated component (e.g. `<RentFigure amount={property.rentPcm} />`) is not
 * a targeted host tag, so it is never flagged — the component owns its own
 * marker.
 */

/** Lowercase host tags a bare figure must not sit inside without a marker. */
const HOST_TAGS = new Set(['span', 'div', 'p', 'td', 'strong', 'b']);

/** Member-property names that denote a rent / price figure. */
const FIGURE_PROPERTY = /^(rent|rentPcm|rentPw|rentPa|price)$/;

/**
 * Frequency / qualifier markers that make a figure trustworthy.
 * PCM = per calendar month, PW = per week, PA = per annum.
 */
const MARKER =
  /\b(PCM|PW|PA|per\s+(calendar\s+)?month|per\s+week|per\s+annum|guide\s+price|offers\s+in\s+region)\b/i;

/**
 * Does this expression reference a targeted rent/price MemberExpression —
 * either directly, or wrapped in a single CallExpression argument (e.g.
 * `formatGBP(property.rentPcm)`)?
 * @param {any} expr
 * @returns {boolean}
 */
function referencesFigureMember(expr) {
  if (!expr) return false;
  if (
    expr.type === 'MemberExpression' &&
    !expr.computed &&
    expr.property &&
    expr.property.type === 'Identifier' &&
    FIGURE_PROPERTY.test(expr.property.name)
  ) {
    return true;
  }
  if (expr.type === 'CallExpression' && Array.isArray(expr.arguments)) {
    return expr.arguments.some((arg) => referencesFigureMember(arg));
  }
  return false;
}

/**
 * Is this an opening-element name a targeted lowercase host tag?
 * @param {any} openingElement
 * @returns {boolean}
 */
function isHostTag(openingElement) {
  const name = openingElement && openingElement.name;
  return Boolean(name && name.type === 'JSXIdentifier' && HOST_TAGS.has(name.name));
}

/**
 * Collect the marker-eligible text of a JSX element: its direct JSXText
 * children plus any string-literal expression children. (Direct children are
 * sufficient for the common cases this heuristic targets — a sibling text node
 * or a quoted string beside the figure.)
 * @param {any[]} children
 * @returns {string}
 */
function markerText(children) {
  let text = '';
  for (const child of children) {
    if (child.type === 'JSXText') {
      text += ` ${child.value}`;
    } else if (
      child.type === 'JSXExpressionContainer' &&
      child.expression &&
      child.expression.type === 'Literal' &&
      typeof child.expression.value === 'string'
    ) {
      text += ` ${child.expression.value}`;
    }
  }
  return text;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an adjacent frequency/qualifier marker beside a bare rent/price figure rendered in a host JSX element (G8 — heuristic).',
    },
    schema: [],
    messages: {
      missingTrustMarker:
        'A rent/price figure is rendered here with no adjacent frequency/qualifier marker (e.g. PCM, per week, guide price). State the basis so the figure cannot mislead (G8).',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (!isHostTag(node.openingElement)) return;

        const hasFigure = node.children.some(
          (child) =>
            child.type === 'JSXExpressionContainer' && referencesFigureMember(child.expression),
        );
        if (!hasFigure) return;

        if (!MARKER.test(markerText(node.children))) {
          context.report({ node, messageId: 'missingTrustMarker' });
        }
      },
    };
  },
};

export default rule;
