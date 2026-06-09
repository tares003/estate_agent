import type { AuditLogOptions } from '../../lib/audit-log.js';

// EPIC-H audit-log viewer (FR-H-17) — the URL is the single source of truth for the
// entity filter + page. Pure parse + serialise helpers, unit-tested so the page
// stays a thin composition. Mirrors the contacts directory's contacts-params.ts.

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse the URL search params into the viewer options. */
export function parseAuditParams(params: RawParams): AuditLogOptions {
  const options: AuditLogOptions = {};

  const entity = single(params['entity']);
  if (entity !== undefined && entity.trim() !== '') options.entity = entity.trim();

  const page = Number.parseInt(single(params['page']) ?? '', 10);
  if (Number.isFinite(page) && page > 1) options.page = page;

  return options;
}

/** Serialise the viewer options to a query string, optionally overriding the page. */
export function auditQuery(options: AuditLogOptions, page?: number): string {
  const params = new URLSearchParams();
  if (options.entity) params.set('entity', options.entity);
  const target = page ?? options.page;
  if (target !== undefined && target > 1) params.set('page', String(target));
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
