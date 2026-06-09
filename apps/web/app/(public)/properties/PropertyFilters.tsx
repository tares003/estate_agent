import { Button, NumberField, Select, TextField, type SelectOption } from '@estate/ui';
import { LISTING_TYPES, type PropertySearch } from '@estate/validators';
import { LISTING_TYPE_LABELS } from './search-params.js';

/**
 * EPIC-F catalogue filter bar (master spec §C.10). A plain GET `<form>` whose
 * controls are native `<select>` / number inputs, so the entire surface is
 * server-rendered and works without JavaScript — the URL is the single source of
 * truth (submitting navigates to `/properties?…`, which resets to page 1 because
 * the form carries no `page` field). Filters/sort are applied together on submit.
 *
 * Price inputs are in pounds (£), the unit a customer thinks in; the route
 * converts to the pence the column stores.
 */

const SALE_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Buy or rent' },
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'To rent' },
];

const LISTING_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any type' },
  ...LISTING_TYPES.map((type) => ({ value: type, label: LISTING_TYPE_LABELS[type] })),
];

const SORT_OPTIONS: SelectOption[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
];

/** "Any … / 1+ / 2+ / …" options for a minimum bedroom/bathroom count. */
function minCountOptions(noun: string): SelectOption[] {
  return [
    { value: '', label: `Any ${noun}` },
    ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+` })),
  ];
}

/** Default-value for a numeric Select, '' when the filter is unset. */
function countValue(value: number | undefined): string {
  return value != null ? String(value) : '';
}

export interface PropertyFiltersProps {
  /** The currently-applied filters, used to pre-fill each control. */
  current: PropertySearch;
}

export function PropertyFilters({ current }: PropertyFiltersProps) {
  return (
    <form
      method="get"
      action="/properties"
      aria-label="Filter properties"
      className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <TextField
        name="location"
        label="Location"
        placeholder="Town or postcode"
        defaultValue={current.location ?? ''}
      />
      <Select
        name="saleType"
        label="Buy or rent"
        options={SALE_TYPE_OPTIONS}
        defaultValue={current.saleType ?? ''}
      />
      <Select
        name="listingType"
        label="Property type"
        options={LISTING_TYPE_OPTIONS}
        defaultValue={current.listingType ?? ''}
      />
      <Select
        name="bedroomsMin"
        label="Bedrooms"
        options={minCountOptions('beds')}
        defaultValue={countValue(current.bedroomsMin)}
      />
      <Select
        name="bathroomsMin"
        label="Bathrooms"
        options={minCountOptions('baths')}
        defaultValue={countValue(current.bathroomsMin)}
      />
      <NumberField
        name="priceMin"
        label="Min price (£)"
        min={0}
        step={1000}
        defaultValue={current.priceMin}
      />
      <NumberField
        name="priceMax"
        label="Max price (£)"
        min={0}
        step={1000}
        defaultValue={current.priceMax}
      />
      <Select name="sort" label="Order by" options={SORT_OPTIONS} defaultValue={current.sort} />
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          Apply filters
        </Button>
      </div>
    </form>
  );
}
