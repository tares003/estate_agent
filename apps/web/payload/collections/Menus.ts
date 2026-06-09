import type { CollectionConfig, Field } from 'payload';

import { tenantCreateAccess, tenantField, tenantScopedAccess } from '../access/tenant.js';

// EPIC-D FR-D-7: CMS-managed navigation menus (header / footer / mobile). One
// tenant-scoped collection; a menu is identified by its `location`, and carries
// an ordered `items` array (Payload arrays give drag + keyboard reorder in the
// admin for free) nested ONE level via `children`. Tenant-isolated at the app
// layer (B23.3) — Payload's Drizzle queries bypass Prisma RLS. Unversioned:
// menus are immediate-on-save (FR-D-7's 60s reflection SLA), unlike Pages.

// The eight staff roles a menu item can be gated to (FR-D-7 "role gates").
// Source of truth: STAFF_ROLES in packages/auth/src/roles.ts — inlined here to
// avoid pulling the heavy @estate/auth (better-auth) dependency into the CMS
// config; keep in sync until the EPIC-N auth integration dedupes them.
const STAFF_ROLE_VALUES = [
  'super_admin',
  'branch_manager',
  'property_manager',
  'sales_agent',
  'lettings_agent',
  'content_editor',
  'repairs_manager',
  'read_only_auditor',
] as const;

/** The leaf fields shared by a menu item and its children (depth cap = 2). */
const menuItemLeafFields: Field[] = [
  { name: 'label', type: 'text', required: true },
  { name: 'url', type: 'text', required: true },
  {
    name: 'target',
    type: 'select',
    required: true,
    defaultValue: 'same',
    options: [
      { label: 'Same tab', value: 'same' },
      { label: 'New tab', value: 'new' },
    ],
  },
  {
    name: 'icon',
    type: 'text',
    admin: { description: 'Optional icon name (token), not an uploaded asset.' },
  },
  {
    name: 'roles',
    type: 'select',
    hasMany: true,
    options: STAFF_ROLE_VALUES.map((role) => ({ label: role, value: role })),
    admin: {
      description: 'Leave empty to show to everyone; set to restrict to those staff roles.',
    },
  },
  { name: 'visibility', type: 'checkbox', required: true, defaultValue: true },
];

export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    group: 'Content',
    useAsTitle: 'label',
  },
  access: {
    read: tenantScopedAccess,
    create: tenantCreateAccess,
    update: tenantScopedAccess,
    delete: tenantScopedAccess,
  },
  fields: [
    tenantField,
    { name: 'label', type: 'text', required: true },
    {
      name: 'location',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Header', value: 'header' },
        { label: 'Footer', value: 'footer' },
        { label: 'Mobile', value: 'mobile' },
      ],
      admin: { description: 'Where this menu renders. One menu per location per tenant.' },
    },
    {
      name: 'items',
      type: 'array',
      admin: { description: 'Ordered, reorderable navigation items (FR-D-7).' },
      fields: [
        ...menuItemLeafFields,
        { name: 'children', type: 'array', fields: menuItemLeafFields },
      ],
    },
  ],
};
