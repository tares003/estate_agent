/**
 * G4 — Audit-log-coverage guard (CLAUDE.md §2: "Audit-log every state-changing
 * action"; master spec audit-log-coverage CI guard).
 *
 * A *mutating server-action handler* is a function that:
 *   1. is a server action — EITHER its own body carries the `'use server'`
 *      directive (a function-level marker), OR it lives in a module whose first
 *      statement is a `'use server'` directive (a file-level server-action
 *      module — the idiomatic shape for actions imported by Client Components,
 *      which Next.js requires over the inline function-level form), AND
 *   2. performs at least one Prisma mutation — a CallExpression whose callee is
 *      `<client>.<model>.<op>` (the client may be `prisma` or a tenant-scoped
 *      `tx`/`db` from a withTenant(...) callback) where <op> is one of:
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
 * are out of scope. A `.update()` whose receiver is not a `<client>.<model>`
 * member chain is ignored.
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
 * Identifier names treated as a Prisma client receiver: the base client, and the
 * tenant-scoped transaction client passed into a withTenant(...) callback. Scoped
 * (not any identifier) so an unrelated `store.session.update(...)` isn't flagged.
 */
const DB_CLIENT_NAMES = new Set(['prisma', 'tx', 'db', 'client', 'dbClient']);

/**
 * True if `node` is a CallExpression of the shape `<client>.<model>.<op>(...)`
 * where <op> is a mutating Prisma operation and <client> is a known DB-client
 * identifier (`prisma`, or the tenant-scoped `tx`/`db` inside a withTenant(...)
 * callback) — so transaction-scoped mutations are covered without flagging an
 * unrelated `store.session.update(...)`.
 * @param {import('estree').Node} node
 */
function isMutationCall(node) {
  if (node.type !== 'CallExpression') return false;
  const op = node.callee;
  // op must be: <modelMember>.<opName>
  if (op.type !== 'MemberExpression' || op.computed) return false;
  if (op.property.type !== 'Identifier' || !MUTATION_OPS.has(op.property.name)) return false;
  // op.object must be: <clientIdentifier>.<model>
  const model = op.object;
  if (model.type !== 'MemberExpression' || model.computed) return false;
  return model.object.type === 'Identifier' && DB_CLIENT_NAMES.has(model.object.name);
}

/**
 * True if `node` is a module-top-level function (no enclosing function in its
 * ancestor chain). In a file-level `'use server'` module, only the top-level
 * handlers are server actions; nested closures (e.g. a withTenant callback) are
 * covered by descent from their enclosing handler, so checking them again would
 * double-report.
 * @param {import('eslint').Rule.Node} node
 */
function isTopLevelFunction(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.type === 'FunctionDeclaration' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'ArrowFunctionExpression'
    ) {
      return false;
    }
  }
  return true;
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
 * Does a statement list begin with a `'use server'` directive? Scans the leading
 * directive prologue (a run of bare string-literal expression statements) and
 * returns true if `'use server'` appears in it. Works for both a function's
 * `body.body` (function-level marker) and a module's `Program.body` (file-level
 * server-action module).
 * @param {import('estree').Statement[] | null | undefined} statements
 */
function hasUseServerDirective(statements) {
  if (!statements) return false;
  for (const stmt of statements) {
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

    // Set once per file: true when the module itself is a `'use server'` module,
    // in which case every top-level handler in it is a server action.
    let fileIsServerModule = false;

    /** @param {import('eslint').Rule.Node} node */
    function checkFunction(node) {
      const body = node.body;
      const functionLevel =
        body && body.type === 'BlockStatement' && hasUseServerDirective(body.body);
      const fileLevel = fileIsServerModule && isTopLevelFunction(node);
      if (!functionLevel && !fileLevel) return;

      let sawMutation = false;
      let sawAudit = false;

      // Scan the whole handler INCLUDING nested closures — the real server-action
      // pattern wraps the mutation (and its audit) in a withTenant(..., (tx) => {
      // ... }) callback, so both live one closure deep. We descend into node's
      // children (params + body); `node` itself is a function, so it never
      // matches the mutation/audit predicates.
      const visit = (n) => {
        if (!n || typeof n.type !== 'string') return;
        if (n !== node) {
          if (isMutationCall(n)) sawMutation = true;
          if (isAuditCall(n)) sawAudit = true;
        }
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
      Program(node) {
        fileIsServerModule = hasUseServerDirective(node.body);
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

export default rule;
