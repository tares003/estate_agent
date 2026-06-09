import type { CollectionConfig } from 'payload';

import { tenantCreateAccess, tenantField, tenantScopedAccess } from '../access/tenant.js';
import { secretField } from '../fields/secret-field.js';

// EPIC-D / CLAUDE.md §9: per-tenant SMTP configuration (the tenant brings their
// own Office 365 / Gmail / any SMTP). Tenant-scoped (app layer, B23.3). The
// `pass` field is encrypted at rest (AES-256-GCM) and masked on read via
// secretField — the platform never stores or returns the password in plaintext.
// getTenantMailer (lib/tenant-mailer.ts) decrypts it server-side at send time.
export const EmailSettings: CollectionConfig = {
  slug: 'email_settings',
  admin: {
    group: 'System',
    useAsTitle: 'fromAddress',
  },
  access: {
    read: tenantScopedAccess,
    create: tenantCreateAccess,
    update: tenantScopedAccess,
    delete: tenantScopedAccess,
  },
  fields: [
    tenantField,
    { name: 'host', type: 'text', required: true },
    { name: 'port', type: 'number', required: true, defaultValue: 587 },
    {
      name: 'secure',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Use implicit TLS on connect (port 465).' },
    },
    { name: 'user', type: 'text', required: true },
    secretField('pass', 'SMTP password / app password. Encrypted at rest; never shown again.'),
    { name: 'fromAddress', type: 'text', required: true },
    { name: 'replyTo', type: 'text' },
  ],
};
