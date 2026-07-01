'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  PROPERTY_CATEGORIES,
  PROPERTY_COUNCIL_TAX_BANDS,
  PROPERTY_EPC_RATINGS,
  PROPERTY_LISTING_TYPES,
  PROPERTY_MARKET_STATUSES,
  PROPERTY_PRICE_QUALIFIERS,
  PROPERTY_PUBLICATION_STATUSES,
  PROPERTY_SALE_TYPES,
  PROPERTY_TENURES,
} from '@estate/validators';
import { Button, FormError, NumberField, Select, TextField, type SelectOption } from '@estate/ui';

import type { PropertyWriteState } from './actions.js';

// EPIC-H property management (FR-H-2 write) / EPIC-F (FR-F-1) — the shared admin
// create + edit form over the CORE property fields. One client component drives both
// surfaces via `useActionState`: /admin/properties/new passes `createProperty` (mode
// "create"), /admin/properties/[id]/edit passes `updateProperty` with `initial` values
// (mode "edit"). Fields are grouped into labelled `<fieldset>` sections (identification,
// pricing, specification, location, descriptions, SEO, publication) and are token-driven
// (G7 — no raw hex/px/ms; layout via Tailwind token utilities). Accessibility is owned by
// the @estate/ui primitives (labels, aria-describedby, error live regions — G9).
//
// The slug-change → 301 redirect on save is handled by the update action (FR-F-5); this
// form just posts the slug. On success a create routes to the new listing's admin page;
// an edit refreshes the route so the header + catalogue reflect the change.
//
// The per-vertical extension fields (FR-F-3, master spec §F.1–§F.6) are DEFERRED to a
// later slice; this form is the always-on CORE only.

const INITIAL: PropertyWriteState = { ok: false };

/** The core fields the form pre-fills in edit mode (a subset of the write schema). */
export interface PropertyFormInitial {
  id: string;
  reference: string;
  listingType: string;
  saleType: string;
  slug: string;
  title: string | null;
  /** Stored price in pence — the form shows pounds. */
  price: number | null;
  priceQualifier: string | null;
  marketStatus: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  category: string | null;
  tenure: string | null;
  councilTaxBand: string | null;
  epcRating: string | null;
  displayAddress: string;
  postcode: string;
  town: string | null;
  description: string | null;
  keyFeatures: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  publicationStatus: string | null;
}

type PropertyWriteAction = (
  prevState: PropertyWriteState,
  formData: FormData,
) => Promise<PropertyWriteState>;

export interface PropertyFormProps {
  /** Whether this is a new listing (create) or an existing one (edit). */
  mode: 'create' | 'edit';
  /** The bound write action — `createProperty` (create) or `updateProperty` (edit). */
  action: PropertyWriteAction;
  /** The listing's current core values — required in edit mode, absent for create. */
  initial?: PropertyFormInitial;
}

/** Humanise a snake_case enum value into a Title Case label ("guide_price" → "Guide price"). */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Build a Select option list from an enum, humanising each value into its label. */
function optionsFor(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: humanise(value) }));
}

const LISTING_TYPE_OPTIONS = optionsFor(PROPERTY_LISTING_TYPES);
const SALE_TYPE_OPTIONS: SelectOption[] = PROPERTY_SALE_TYPES.map((value) => ({
  value,
  label: value === 'rent' ? 'To rent' : 'For sale',
}));
const PRICE_QUALIFIER_OPTIONS = optionsFor(PROPERTY_PRICE_QUALIFIERS);
const MARKET_STATUS_OPTIONS = optionsFor(PROPERTY_MARKET_STATUSES);
const CATEGORY_OPTIONS = optionsFor(PROPERTY_CATEGORIES);
const TENURE_OPTIONS = optionsFor(PROPERTY_TENURES);
const COUNCIL_TAX_OPTIONS: SelectOption[] = PROPERTY_COUNCIL_TAX_BANDS.map((value) => ({
  value,
  label: value === 'exempt' || value === 'unknown' ? humanise(value) : value.toUpperCase(),
}));
const EPC_OPTIONS: SelectOption[] = PROPERTY_EPC_RATINGS.map((value) => ({
  value,
  label: value === 'pending' ? 'Pending' : value.toUpperCase(),
}));
const PUBLICATION_OPTIONS = optionsFor(PROPERTY_PUBLICATION_STATUSES);

/** The empty-choice prompt entry for an optional enum (means "leave unset"). */
const NONE_OPTION: SelectOption = { value: '', label: '— Not set —' };

/** Prepend the "not set" option so an optional enum can be left / cleared. */
function withNone(options: SelectOption[]): SelectOption[] {
  return [NONE_OPTION, ...options];
}

interface OptionalEnumFieldProps {
  id: string;
  name: string;
  label: string;
  hint?: string;
  options: SelectOption[];
  defaultValue: string;
  error?: ReactNode;
}

/**
 * An OPTIONAL enum field. The visible native `<select>` carries NO form name — a
 * hidden input carries the field `name`, and only when a real value is chosen. This
 * means "— Not set —" submits NOTHING (rather than an empty string), so the write
 * schema's `z.enum(...).optional()` sees `undefined` (valid) instead of `''` (invalid).
 * Controlled so the hidden mirror stays in sync with the user's choice.
 */
function OptionalEnumField({
  id,
  name,
  label,
  hint,
  options,
  defaultValue,
  error,
}: OptionalEnumFieldProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <Select
        id={id}
        label={label}
        {...(hint !== undefined ? { hint } : {})}
        options={withNone(options)}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...(error !== undefined ? { error } : {})}
      />
      {value !== '' ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}

/** Split a key-features textarea value into its non-blank, trimmed lines. */
function keyFeatureLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function PropertyForm({ mode, action, initial }: PropertyFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  // Key features are edited as free text (one per line) but submitted as one form field
  // per feature, so the action's `formData.getAll('keyFeatures')` receives a real array.
  const [keyFeaturesText, setKeyFeaturesText] = useState((initial?.keyFeatures ?? []).join('\n'));
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    if (mode === 'create' && state.id) {
      router.push(`/admin/properties/${state.id}`);
    } else {
      router.refresh();
    }
  }, [state, mode, router]);

  const errorFor = (name: string): ReactNode =>
    state.errors?.find((error) => error.field === name)?.message;
  const num = (value: number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);
  const keyFeatures = keyFeatureLines(keyFeaturesText);
  const submitLabel = mode === 'create' ? 'Create property' : 'Save changes';

  return (
    <form action={formAction} noValidate className="flex max-w-[46rem] flex-col gap-8">
      <FormError errors={state.errors ?? []} />
      {state.ok ? (
        <p className="t-body-sm text-success" role="status">
          {mode === 'create' ? 'Property created.' : 'Changes saved.'}
        </p>
      ) : null}

      {mode === 'edit' && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Identification</legend>
        {mode === 'create' ? (
          <TextField
            id="reference"
            name="reference"
            label="Reference"
            hint="Your internal listing reference."
            required
            defaultValue={initial?.reference ?? ''}
            error={errorFor('reference')}
          />
        ) : null}
        <TextField
          id="title"
          name="title"
          label="Title"
          hint="Optional headline for the listing."
          defaultValue={initial?.title ?? ''}
          error={errorFor('title')}
        />
        <TextField
          id="slug"
          name="slug"
          label="URL slug"
          hint={
            mode === 'create'
              ? 'Leave blank to generate from the title, town and postcode.'
              : 'Changing this creates a 301 redirect from the old URL.'
          }
          defaultValue={initial?.slug ?? ''}
          error={errorFor('slug')}
        />
        {mode === 'create' ? (
          <>
            <Select
              id="listingType"
              name="listingType"
              label="Listing type"
              required
              options={LISTING_TYPE_OPTIONS}
              defaultValue="residential"
              error={errorFor('listingType')}
            />
            <Select
              id="saleType"
              name="saleType"
              label="Sale type"
              required
              options={SALE_TYPE_OPTIONS}
              defaultValue="sale"
              error={errorFor('saleType')}
            />
          </>
        ) : (
          <>
            <OptionalEnumField
              id="listingType"
              name="listingType"
              label="Listing type"
              options={LISTING_TYPE_OPTIONS}
              defaultValue={initial?.listingType ?? ''}
              error={errorFor('listingType')}
            />
            <OptionalEnumField
              id="saleType"
              name="saleType"
              label="Sale type"
              options={SALE_TYPE_OPTIONS}
              defaultValue={initial?.saleType ?? ''}
              error={errorFor('saleType')}
            />
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Pricing</legend>
        <NumberField
          id="price"
          name="price"
          label="Price (£)"
          hint="Leave blank for price on application."
          defaultValue={
            initial?.price === null || initial?.price === undefined
              ? ''
              : String(initial.price / 100)
          }
          error={errorFor('price')}
        />
        <OptionalEnumField
          id="priceQualifier"
          name="priceQualifier"
          label="Price qualifier"
          options={PRICE_QUALIFIER_OPTIONS}
          defaultValue={initial?.priceQualifier ?? ''}
          error={errorFor('priceQualifier')}
        />
        <OptionalEnumField
          id="marketStatus"
          name="marketStatus"
          label="Market status"
          options={MARKET_STATUS_OPTIONS}
          defaultValue={initial?.marketStatus ?? ''}
          error={errorFor('marketStatus')}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Specification</legend>
        <NumberField
          id="bedrooms"
          name="bedrooms"
          label="Bedrooms"
          defaultValue={num(initial?.bedrooms)}
          error={errorFor('bedrooms')}
        />
        <NumberField
          id="bathrooms"
          name="bathrooms"
          label="Bathrooms"
          defaultValue={num(initial?.bathrooms)}
          error={errorFor('bathrooms')}
        />
        <OptionalEnumField
          id="category"
          name="category"
          label="Category"
          options={CATEGORY_OPTIONS}
          defaultValue={initial?.category ?? ''}
          error={errorFor('category')}
        />
        <OptionalEnumField
          id="tenure"
          name="tenure"
          label="Tenure"
          options={TENURE_OPTIONS}
          defaultValue={initial?.tenure ?? ''}
          error={errorFor('tenure')}
        />
        <OptionalEnumField
          id="councilTaxBand"
          name="councilTaxBand"
          label="Council tax band"
          options={COUNCIL_TAX_OPTIONS}
          defaultValue={initial?.councilTaxBand ?? ''}
          error={errorFor('councilTaxBand')}
        />
        <OptionalEnumField
          id="epcRating"
          name="epcRating"
          label="EPC rating"
          options={EPC_OPTIONS}
          defaultValue={initial?.epcRating ?? ''}
          error={errorFor('epcRating')}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Location</legend>
        <TextField
          id="displayAddress"
          name="displayAddress"
          label="Display address"
          hint="The public marketing address shown on the listing."
          required
          defaultValue={initial?.displayAddress ?? ''}
          error={errorFor('displayAddress')}
        />
        <TextField
          id="postcode"
          name="postcode"
          label="Postcode"
          required
          defaultValue={initial?.postcode ?? ''}
          error={errorFor('postcode')}
        />
        <TextField
          id="town"
          name="town"
          label="Town"
          defaultValue={initial?.town ?? ''}
          error={errorFor('town')}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Descriptions</legend>
        <label htmlFor="description" className="flex flex-col gap-1">
          <span className="t-body-sm text-text-secondary">Description</span>
          <textarea
            id="description"
            name="description"
            rows={6}
            className="border-divider rounded-md border px-3 py-2"
            defaultValue={initial?.description ?? ''}
            aria-invalid={errorFor('description') !== undefined}
            aria-describedby={
              errorFor('description') !== undefined ? 'description-error' : undefined
            }
          />
          {errorFor('description') !== undefined ? (
            <span id="description-error" role="alert" className="t-body-sm text-danger">
              {errorFor('description')}
            </span>
          ) : null}
        </label>
        <label htmlFor="keyFeatures" className="flex flex-col gap-1">
          <span className="t-body-sm text-text-secondary">Key features</span>
          <span id="keyFeatures-hint" className="t-body-sm text-text-secondary">
            One feature per line.
          </span>
          <textarea
            id="keyFeatures"
            rows={5}
            className="border-divider rounded-md border px-3 py-2"
            value={keyFeaturesText}
            onChange={(event) => setKeyFeaturesText(event.target.value)}
            aria-describedby={
              errorFor('keyFeatures') !== undefined
                ? 'keyFeatures-hint keyFeatures-error'
                : 'keyFeatures-hint'
            }
            aria-invalid={errorFor('keyFeatures') !== undefined}
          />
          {/* One submitted field per feature so the action's getAll('keyFeatures') is an array. */}
          {keyFeatures.map((feature, index) => (
            <input key={`${feature}-${index}`} type="hidden" name="keyFeatures" value={feature} />
          ))}
          {errorFor('keyFeatures') !== undefined ? (
            <span id="keyFeatures-error" role="alert" className="t-body-sm text-danger">
              {errorFor('keyFeatures')}
            </span>
          ) : null}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Search engine</legend>
        <TextField
          id="metaTitle"
          name="metaTitle"
          label="Meta title"
          hint="Optional. Overrides the default page title in search results."
          defaultValue={initial?.metaTitle ?? ''}
          error={errorFor('metaTitle')}
        />
        <TextField
          id="metaDescription"
          name="metaDescription"
          label="Meta description"
          hint="Optional. The snippet shown under the title in search results."
          defaultValue={initial?.metaDescription ?? ''}
          error={errorFor('metaDescription')}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-heading-sm mb-2">Publication</legend>
        <OptionalEnumField
          id="publicationStatus"
          name="publicationStatus"
          label="Publication status"
          hint="Drafts are hidden from the public catalogue."
          options={PUBLICATION_OPTIONS}
          defaultValue={initial?.publicationStatus ?? ''}
          error={errorFor('publicationStatus')}
        />
      </fieldset>

      <div>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
