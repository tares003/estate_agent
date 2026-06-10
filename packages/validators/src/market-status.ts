import { z } from 'zod';

// EPIC-H property management (FR-H-2, master spec §J.3) — the property market-status
// vocabulary + the admin change input. The values mirror the Prisma `MarketStatus`
// enum (the schema is the source of truth, G6). The master spec lists the statuses
// but imposes no restrictive transition allow-list, so any value is settable; the
// change is recorded on the property status timeline (PropertyStatusEvent).

export const MARKET_STATUSES = [
  'for_sale',
  'under_offer',
  'sold_stc',
  'sold',
  'to_let',
  'let_agreed',
  'let',
  'withdrawn',
] as const;

export type MarketStatus = (typeof MARKET_STATUSES)[number];

export const marketStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  marketStatus: z.enum(MARKET_STATUSES),
});

export type MarketStatusUpdate = z.infer<typeof marketStatusUpdateSchema>;
