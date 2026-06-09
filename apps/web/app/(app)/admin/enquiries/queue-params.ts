import { ENQUIRY_STATUSES, type EnquiryStatus } from '@estate/validators';

import type { EnquiryQueueOptions } from '../../lib/enquiries.js';

// EPIC-H enquiry queue (FR-H-3) — the URL is the single source of truth for the
// queue's status filter / sort / page (shareable, back-button-safe). Pure parse +
// serialise helpers (no DB, no React), unit-tested so the page stays a thin
// composition. Mirrors the catalogue's search-params.ts.

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isEnquiryStatus(value: string): value is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(value);
}

/** Parse the URL search params into the read model's options (invalid values dropped). */
export function parseEnquiryQueueParams(params: RawParams): EnquiryQueueOptions {
  const options: EnquiryQueueOptions = {};

  const status = single(params['status']);
  if (status !== undefined && isEnquiryStatus(status)) options.status = status;

  if (single(params['sort']) === 'oldest') options.sort = 'oldest';

  const page = Number.parseInt(single(params['page']) ?? '', 10);
  if (Number.isFinite(page) && page > 1) options.page = page;

  return options;
}

/** Serialise the queue options to a query string, optionally overriding the page. */
export function enquiryQueueQuery(options: EnquiryQueueOptions, page?: number): string {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.sort) params.set('sort', options.sort);
  const target = page ?? options.page;
  if (target !== undefined && target > 1) params.set('page', String(target));
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
