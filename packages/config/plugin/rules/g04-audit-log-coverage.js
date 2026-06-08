/**
 * G4 — Audit-log-coverage guard (CLAUDE.md §2: "Audit-log every state-changing
 * action"; master spec audit-log-coverage CI guard).
 *
 * A *mutating server-action handler* is a function whose body:
 *   1. carries the `'use server'` directive (a top-of-body string-literal
 *      ExpressionStatement, the App Router server-action marker), AND
 *   2. performs at least one Prisma mutation — a CallExpression whose callee is
 *      `prisma.<model>.<op>` where <op> is one of:
 *      create, update, delete, upsert, createMany, updateMany, deleteMany.
 *
 * Such a handler MUST, in the same function body, ALSO either:
 *   - call `audit(...)` (a CallExpression to the identifier `audit`), OR
 *   - carry an exemption comment matching /audit-exempt:/ inside the function's
 *     source range (line or block comment).
 *
 * If neither is present the rule reports once on the function node with
 * messageId `missingAudit`.
 *
 * Reads (findUnique, findMany, count, …) and mutations outside a server action
 * are out of scope. A `.update()` on a non-`prisma` receiver is not a Prisma
 * mutation and is ignored.
 */

/** Prisma write operations that mutate persisted state. */
const MUTATION_OPS = new Set([
  'create',
  'update',
  'delete',
  'upsert',
  'createMany',
  'updateMany',
  'deleteMany',
]);

/**
 * True if `node` is a CallExpression of the shape `prisma.<model>.<op>(...)`
 * where <op> is a mutating Prisma operation.
 * @param {import('estree').Node} node
 */
function isPrismaMutationCall(node) {
  if (node.type !== 'CallExpression') return false;
  const op = node.callee;
  // op must be: <modelMember>.<opName>
  if (op.type !== 'MemberExpression' || op.computed) return false;
  if (op.property.type !== 'Identifier' || !MUTATION_OPS.has(op.property.name)) return false;
  // op.object must be: prisma.<model>
  const model = op.object;
  if (model.type !== 'MemberExpression' || model.computed) return false;
  const base = model.object;
  return base.type === 'Identifier' && base.name === 'prisma';
}

/** True if `node` is a CallExpression to the bare identifier `audit`. */
function isAuditCall(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'audit'
  );
}

/**
 * Does the function body begin with the `'use server'` directive?
 * @param {import('estree').BlockStatement | null | undefined} body
 */
function hasUseServerDirective(body) {
  if (!body || body.type !== 'BlockStatement') return false;
  for (const stmt of body.body) {
    if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'Literal' &&
      stmt.expression.value === 'use server'
    ) {
      return true;
    }
    // directive prologue ends at the first non-string-literal statement
    if (
      stmt.type !== 'ExpressionStatement' ||
      stmt.expression.type !== 'Literal' ||
      typeof stmt.expression.value !== 'string'
    ) {
      return false;
    }
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an audit() call (or audit-exempt comment) in every mutating server-action handler (CLAUDE.md §2).',
    },
    schema: [],
    messages: {
      missingAudit:
        "This 'use server' handler performs a Prisma mutation but never calls audit(...). Every state-changing action must emit an audit_logs row — call audit(...) with the actor/action/entity/entity_id/diff fields, or annotate with an `audit-exempt:` comment (CLAUDE.md §2).",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** @param {import('eslint').Rule.Node} node */
    function checkFunction(node) {
      const body = node.body;
      if (!hasUseServerDirective(body)) return;

      let sawMutation = false;
      let sawAudit = false;

      // Walk only this function's own body — not nested functions, so that a
      // mutation in this scope is not "covered" by an audit() inside a closure
      // (and vice versa). We scan the statement subtree but stop descending at
      // nested function boundaries.
      const visit = (n) => {
        if (!n || typeof n.type !== 'string') return;
        if (n === node) {
          // descend into the function's body block
          for (const stmt of body.body) visit(stmt);
          return;
        }
        // do not cross into nested function scopes
        if (
          n.type === 'FunctionDeclaration' ||
          n.type === 'FunctionExpression' ||
          n.type === 'ArrowFunctionExpression'
        ) {
          return;
        }
        if (isPrismaMutationCall(n)) sawMutation = true;
        if (isAuditCall(n)) sawAudit = true;
        for (const key of Object.keys(n)) {
          if (key === 'parent') continue;
          const child = n[key];
          if (Array.isArray(child)) {
            for (const c of child) {
              if (c && typeof c.type === 'string') visit(c);
            }
          } else if (child && typeof child.type === 'string') {
            visit(child);
          }
        }
      };
      visit(node);

      if (!sawMutation || sawAudit) return;

      // Exemption: any comment matching /audit-exempt:/ inside the function range.
      const exempt = sourceCode
        .getAllComments()
        .some(
          (comment) =>
            comment.range[0] >= node.range[0] &&
            comment.range[1] <= node.range[1] &&
            /audit-exempt:/.test(comment.value),
        );
      if (exempt) return;

      context.report({ node, messageId: 'missingAudit' });
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

export default rule;
