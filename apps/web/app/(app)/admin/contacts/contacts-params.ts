import { CONTACT_TYPES, type ContactType } from '@estate/validators';

import type { ContactListOptions } from '../../lib/contacts.js';

// EPIC-H contacts (FR-H-7) — the URL is the single source of truth for the
// directory's type filter + page. Pure parse + serialise helpers, unit-tested so
// the page stays a thin composition. Mirrors the enquiry queue's queue-params.ts.

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isContactType(value: string): value is ContactType {
  return (CONTACT_TYPES as readonly string[]).includes(value);
}

/** Parse the URL search params into the directory options (invalid values dropped). */
export function parseContactListParams(params: RawParams): ContactListOptions {
  const options: ContactListOptions = {};

  const type = single(params['type']);
  if (type !== undefined && isContactType(type)) options.type = type;

  const page = Number.parseInt(single(params['page']) ?? '', 10);
  if (Number.isFinite(page) && page > 1) options.page = page;

  return options;
}

/** Serialise the directory options to a query string, optionally overriding the page. */
export function contactListQuery(options: ContactListOptions, page?: number): string {
  const params = new URLSearchParams();
  if (options.type) params.set('type', options.type);
  const target = page ?? options.page;
  if (target !== undefined && target > 1) params.set('page', String(target));
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
