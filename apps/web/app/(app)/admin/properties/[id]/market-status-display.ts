import { type MarketStatus } from '@estate/validators';

// EPIC-H property management (FR-H-2) — presentation for the market-status control.
// Pure (no React), so the labels + the sale-type grouping are unit-tested. The
// statuses are grouped by sale type (a sale listing can't be "Let", a rental can't
// be "Sold"); `withdrawn` applies to both. Spec lists the values but no transition
// allow-list, so every status in the relevant group is selectable.

const LABELS: Record<MarketStatus, string> = {
  for_sale: 'For sale',
  under_offer: 'Under offer',
  sold_stc: 'Sold STC',
  sold: 'Sold',
  to_let: 'To let',
  let_agreed: 'Let agreed',
  let: 'Let',
  withdrawn: 'Withdrawn',
};

const SALE_STATUSES: readonly MarketStatus[] = [
  'for_sale',
  'under_offer',
  'sold_stc',
  'sold',
  'withdrawn',
];
const RENT_STATUSES: readonly MarketStatus[] = ['to_let', 'let_agreed', 'let', 'withdrawn'];

/** The display label for a market status. */
export function marketStatusLabel(status: string): string {
  return (LABELS as Record<string, string>)[status] ?? status;
}

/** The statuses selectable for a listing of the given sale type (`sale` | `rent`). */
export function marketStatusesForSaleType(saleType: string): readonly MarketStatus[] {
  return saleType === 'rent' ? RENT_STATUSES : SALE_STATUSES;
}
