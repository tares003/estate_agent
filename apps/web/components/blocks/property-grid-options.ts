import { z } from 'zod';

import type { PropertySearchOptions } from '../../app/(app)/lib/properties.js';

// EPIC-D FR-D-2 `property_grid` config. The block stores filter CONFIG, not the
// rendered output; PropertyGridBlock (async) fetches matching properties from the
// catalogue using these options. Kept pure + Payload-runtime-free so it is
// node-env unit-testable and safe to import from the lightweight block registry.

export const propertyGridBlockSchema = z.object({
  heading: z.string().optional(),
  saleType: z.enum(['sale', 'rent']).optional(),
  listingType: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export type PropertyGridConfig = z.infer<typeof propertyGridBlockSchema>;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Map the block config to catalogue search options (heading is presentational). */
export function propertyGridToOptions(config: PropertyGridConfig): PropertySearchOptions {
  const options: PropertySearchOptions = { page: 1, pageSize: clamp(config.limit ?? 6, 1, 24) };
  if (config.saleType) {
    options.saleType = config.saleType;
  }
  if (config.listingType) {
    options.listingType = config.listingType;
  }
  return options;
}
