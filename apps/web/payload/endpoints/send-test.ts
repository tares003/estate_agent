import type { TemplateValues } from '@estate/email';
import type { PayloadHandler } from 'payload';

import { buildTemplateInput, sampleValuesFor } from '../../app/(app)/lib/email-template.js';
import { getTenantFromReq } from '../access/tenant.js';

// FR-D-8 send-test endpoint: POST /admin/cms/api/email_templates/:id/send-test
// with { to, values? }. Renders the template (Lexical body → HTML, then variable
// interpolation) and sends it to `to` via the tenant's configured Mailer. Auth +
// tenant come from the Payload request. GLUE — the heavy deps (Lexical→HTML,
// per-tenant Mailer, the send) are dynamically imported so this module (and the
// collection that registers it) stays light for the node-env collection tests;
// excluded from unit coverage (the testable mapping lives in email-template.ts +
// @estate/email, both unit-tested). Resilient: returns a JSON error, never throws.

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

export const sendTestEndpoint: PayloadHandler = async (req) => {
  if (!req.user) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const id = req.routeParams?.['id'];
  if (typeof id !== 'string' || id === '') {
    return json({ error: 'Missing template id' }, 400);
  }

  const body = (await req.json?.()) as { to?: unknown; values?: TemplateValues } | undefined;
  const to = body?.to;
  if (typeof to !== 'string' || to === '') {
    return json({ error: 'A recipient (to) is required' }, 400);
  }

  const tenantId = getTenantFromReq(req);
  if (!tenantId) {
    return json({ error: 'No tenant resolved for this request' }, 400);
  }

  const doc = await req.payload
    .findByID({ collection: 'email_templates', id, req, overrideAccess: false })
    .catch(() => null);
  if (!doc) {
    return json({ error: 'Template not found' }, 404);
  }

  const [{ convertLexicalToHTML }, { getTenantMailer }, { sendTemplatedEmail }] = await Promise.all(
    [
      import('@payloadcms/richtext-lexical/html'),
      import('../../app/(app)/lib/tenant-mailer.js'),
      import('@estate/email'),
    ],
  );

  const mailer = await getTenantMailer(tenantId);
  if (!mailer) {
    return json({ error: 'SMTP is not configured for this tenant' }, 400);
  }

  const input = buildTemplateInput(doc, (lexical) =>
    convertLexicalToHTML({ data: lexical as Parameters<typeof convertLexicalToHTML>[0]['data'] }),
  );
  const values = { ...sampleValuesFor(doc.variables), ...(body?.values ?? {}) };

  try {
    const result = await sendTemplatedEmail(mailer, input, values, to);
    return json({ messageId: result.messageId, to }, 200);
  } catch {
    return json({ error: 'Send failed — check the tenant SMTP settings' }, 502);
  }
};
