import type { CollectionConfig } from 'payload';

import { tenantCreateAccess, tenantField, tenantScopedAccess } from '../access/tenant.js';

// EPIC-D FR-D-8: CMS-managed transactional email templates. Tenant-scoped (app
// layer, B23.3). Each template carries a stable `key` (the code that triggers a
// send looks it up), a human `name`, a `subject` + optional `preheader` + a
// structured `body` (Lexical), and the `variables` it declares. Rendering +
// sending is done by @estate/email's renderTemplate / sendTemplatedEmail; wiring
// the admin "send test" button to a per-tenant Mailer awaits the tenant SMTP
// credential store (follow-up).
export const EmailTemplates: CollectionConfig = {
  slug: 'email_templates',
  admin: {
    group: 'System',
    useAsTitle: 'name',
  },
  access: {
    read: tenantScopedAccess,
    create: tenantCreateAccess,
    update: tenantScopedAccess,
    delete: tenantScopedAccess,
  },
  fields: [
    tenantField,
    {
      name: 'key',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Stable identifier the sending code looks up, e.g. "welcome".' },
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: { description: 'Email subject. Supports {{variables}}.' },
    },
    {
      name: 'preheader',
      type: 'text',
      admin: { description: 'Hidden inbox-preview text. Supports {{variables}}.' },
    },
    {
      name: 'body',
      type: 'richText',
      admin: { description: 'Structured email body. Supports {{variables}} in text.' },
    },
    {
      name: 'variables',
      type: 'array',
      admin: { description: 'The {{variables}} this template declares.' },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
      ],
    },
  ],
};
