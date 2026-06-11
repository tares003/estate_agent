import {
  REPAIR_STATUSES,
  repairUrgency,
  type RepairStatus,
  type RepairUrgency,
} from '@estate/validators';

import type { RepairQueueOptions } from '../../lib/repairs.js';

// EPIC-G repairs inbox (FR-G-2) — the URL is the single source of truth for the
// inbox's status / urgency filters, sort and page (shareable, back-button-safe).
// Pure parse + serialise helpers (no DB, no React), unit-tested so the page stays
// a thin composition. Mirrors the enquiry queue's queue-params.ts.

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRepairStatus(value: string): value is RepairStatus {
  return (REPAIR_STATUSES as readonly string[]).includes(value);
}

function isRepairUrgency(value: string): value is RepairUrgency {
  return repairUrgency.safeParse(value).success;
}

/** Parse the URL search params into the read model's options (invalid values dropped). */
export function parseRepairQueueParams(params: RawParams): RepairQueueOptions {
  const options: RepairQueueOptions = {};

  const status = single(params['status']);
  if (status !== undefined && isRepairStatus(status)) options.status = status;

  const urgency = single(params['urgency']);
  if (urgency !== undefined && isRepairUrgency(urgency)) options.urgency = urgency;

  if (single(params['sort']) === 'oldest') options.sort = 'oldest';

  const page = Number.parseInt(single(params['page']) ?? '', 10);
  if (Number.isFinite(page) && page > 1) options.page = page;

  return options;
}

/** Serialise the inbox options to a query string, optionally overriding the page. */
export function repairQueueQuery(options: RepairQueueOptions, page?: number): string {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.urgency) params.set('urgency', options.urgency);
  if (options.sort) params.set('sort', options.sort);
  const target = page ?? options.page;
  if (target !== undefined && target > 1) params.set('page', String(target));
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
