import type { PropertyCardStatus } from '@estate/ui';

// EPIC-F / PRODUCT.md §8 display helpers — the trust-marker logic lives here:
// every price carries a qualifier, every rent figure a frequency.

/** §J `market_status` → the PropertyCard status variant (to_let renders "To rent"). */
const STATUS_MAP: Record<string, PropertyCardStatus> = {
  for_sale: 'for_sale',
  to_let: 'to_rent',
  under_offer: 'under_offer',
  sold_stc: 'sold_stc',
  sold: 'sold',
  let_agreed: 'let_agreed',
  let: 'let',
  withdrawn: 'withdrawn',
};

export function toCardStatus(marketStatus: string): PropertyCardStatus {
  return STATUS_MAP[marketStatus] ?? 'for_sale';
}

/** Format a price stored in pence as GBP, e.g. 52500000 → "£525,000". Null → "POA". */
export function formatPrice(pence: number | null | undefined): string {
  if (pence == null) return 'POA';
  const pounds = Math.round(pence / 100);
  return `£${new Intl.NumberFormat('en-GB').format(pounds)}`;
}

/** The price qualifier shown above the price (PRODUCT.md §8 — never a bare price). */
const QUALIFIER: Record<string, string> = {
  for_sale: 'Guide price',
  under_offer: 'Guide price',
  to_let: 'Asking rent',
  let_agreed: 'Agreed rent',
  let: 'Now let at',
  sold_stc: 'Sold subject to contract',
  sold: 'Sold for',
  withdrawn: 'Marketing withdrawn',
};

export function priceQualifier(marketStatus: string): string {
  return QUALIFIER[marketStatus] ?? 'Guide price';
}

/** Rent frequency for lettings (PRODUCT.md §8 — every rent figure shows its frequency). */
export function rentFrequency(saleType: string): 'PCM' | undefined {
  return saleType === 'rent' ? 'PCM' : undefined;
}
