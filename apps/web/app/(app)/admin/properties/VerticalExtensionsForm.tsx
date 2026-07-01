'use client';

import { useState, type ReactNode } from 'react';
import { PROPERTY_COMMERCIAL_USE_CLASSES, PROPERTY_CQC_RATINGS } from '@estate/validators';
import { Checkbox, NumberField, Select, TextField, type SelectOption } from '@estate/ui';

// EPIC-F FR-F-3 — the per-vertical EXTENSION subsections of the property admin form
// (master spec §F.3–§F.6). One Property entity discriminated by listingType (FR-F-2)
// carries every vertical's fields; this component renders ONLY the subsection matching
// the current listing type, AND only when that vertical is authorable for the tenant.
// A residential or land listing surfaces nothing here.
//
// Entitlement (EPIC-AD / G12) is decided SERVER-SIDE: the route resolves the enabled
// vertical listing types via the canonical isPackEnabled check (lib/packs.ts) and passes
// the allow-list in — this client never names or evaluates a pack slug itself. Token-driven
// (G7) via the @estate/ui primitives; accessibility (labels, aria) is owned by them (G9).

/** The extension values the form pre-fills in edit mode (all optional / nullable). */
export interface VerticalExtensionsInitial {
  isOffPlan?: boolean | null;
  developmentName?: string | null;
  vatPayable?: boolean | null;
  annualBusinessRates?: number | null;
  useClass?: string | null;
  annualTurnover?: number | null;
  grossProfit?: number | null;
  netProfit?: number | null;
  yearsTrading?: number | null;
  staffCount?: number | null;
  currentAnnualRent?: number | null;
  isConfidential?: boolean | null;
  bedCount?: number | null;
  cqcRating?: string | null;
  cqcInspectionUrl?: string | null;
  isGoingConcern?: boolean | null;
}

export interface VerticalExtensionsFormProps {
  /** The listing type currently selected on the parent form. */
  listingType: string;
  /**
   * The vertical listing types the tenant may author (resolved server-side via the
   * canonical isPackEnabled check in lib/packs.ts). A subsection renders only when its
   * listing type is in this allow-list — so entitlement is decided upstream, not here.
   */
  enabledVerticals: readonly string[];
  /** The extension values to pre-fill (edit mode). */
  initial?: VerticalExtensionsInitial;
  /** Look up a field's server-side error message, if any. */
  errorFor?: (name: string) => ReactNode;
}

/** Humanise a snake_case enum value into Title Case ("sui_generis" → "Sui generis"). */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const USE_CLASS_OPTIONS: SelectOption[] = PROPERTY_COMMERCIAL_USE_CLASSES.map((value) => ({
  value,
  label: value === 'sui_generis' || value === 'other' ? humanise(value) : value.toUpperCase(),
}));
const CQC_OPTIONS: SelectOption[] = PROPERTY_CQC_RATINGS.map((value) => ({
  value,
  label: humanise(value),
}));

/** The empty-choice prompt for an optional enum (means "leave unset"). */
const NONE_OPTION: SelectOption = { value: '', label: '— Not set —' };

/**
 * An OPTIONAL enum field whose "— Not set —" choice submits NOTHING (a hidden mirror
 * carries the name only when a real value is picked), so the write schema's
 * `z.enum(...).optional()` sees `undefined` not `''`. Mirrors PropertyForm's pattern.
 */
function OptionalEnumField({
  id,
  name,
  label,
  options,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue: string;
  error?: ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <Select
        id={id}
        label={label}
        options={[NONE_OPTION, ...options]}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...(error !== undefined ? { error } : {})}
      />
      {value !== '' ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}

/** Format a nullable number for a NumberField default value ('' when unset). */
function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Shared props each per-vertical subsection takes. */
interface SubsectionProps {
  v: VerticalExtensionsInitial;
  err: (name: string) => ReactNode;
}

/** §F.3 new-home extension subsection. */
function NewHomeFields({ v, err }: SubsectionProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="t-heading-sm mb-2">New home details</legend>
      <TextField
        id="developmentName"
        name="developmentName"
        label="Development name"
        hint="The name of the development this home belongs to."
        defaultValue={v.developmentName ?? ''}
        error={err('developmentName')}
      />
      <Checkbox
        id="isOffPlan"
        name="isOffPlan"
        label="Off-plan"
        description="This home is being sold before construction is complete."
        defaultChecked={v.isOffPlan ?? false}
      />
    </fieldset>
  );
}

/** §F.4 commercial extension subsection. */
function CommercialFields({ v, err }: SubsectionProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="t-heading-sm mb-2">Commercial details</legend>
      <OptionalEnumField
        id="useClass"
        name="useClass"
        label="Use class"
        options={USE_CLASS_OPTIONS}
        defaultValue={v.useClass ?? ''}
        error={err('useClass')}
      />
      <NumberField
        id="annualBusinessRates"
        name="annualBusinessRates"
        label="Annual business rates (£)"
        defaultValue={num(v.annualBusinessRates)}
        error={err('annualBusinessRates')}
      />
      <Checkbox
        id="vatPayable"
        name="vatPayable"
        label="VAT payable"
        description="VAT is charged on the sale or rent of this property."
        defaultChecked={v.vatPayable ?? false}
      />
    </fieldset>
  );
}

/** §F.5 business-transfer extension subsection. */
function BusinessTransferFields({ v, err }: SubsectionProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="t-heading-sm mb-2">Business transfer details</legend>
      <NumberField
        id="annualTurnover"
        name="annualTurnover"
        label="Annual turnover (£)"
        defaultValue={num(v.annualTurnover)}
        error={err('annualTurnover')}
      />
      <NumberField
        id="grossProfit"
        name="grossProfit"
        label="Gross profit (£)"
        defaultValue={num(v.grossProfit)}
        error={err('grossProfit')}
      />
      <NumberField
        id="netProfit"
        name="netProfit"
        label="Net profit (£)"
        defaultValue={num(v.netProfit)}
        error={err('netProfit')}
      />
      <NumberField
        id="yearsTrading"
        name="yearsTrading"
        label="Years trading"
        defaultValue={num(v.yearsTrading)}
        error={err('yearsTrading')}
      />
      <NumberField
        id="staffCount"
        name="staffCount"
        label="Staff count"
        defaultValue={num(v.staffCount)}
        error={err('staffCount')}
      />
      <NumberField
        id="currentAnnualRent"
        name="currentAnnualRent"
        label="Current annual rent (£)"
        defaultValue={num(v.currentAnnualRent)}
        error={err('currentAnnualRent')}
      />
      <Checkbox
        id="isConfidential"
        name="isConfidential"
        label="Confidential"
        description="Hide the business name and exact address from the public listing."
        defaultChecked={v.isConfidential ?? false}
      />
    </fieldset>
  );
}

/** §F.6 care-home extension subsection. */
function CareHomeFields({ v, err }: SubsectionProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="t-heading-sm mb-2">Care home details</legend>
      <NumberField
        id="bedCount"
        name="bedCount"
        label="Bed count"
        defaultValue={num(v.bedCount)}
        error={err('bedCount')}
      />
      <OptionalEnumField
        id="cqcRating"
        name="cqcRating"
        label="CQC rating"
        options={CQC_OPTIONS}
        defaultValue={v.cqcRating ?? ''}
        error={err('cqcRating')}
      />
      <TextField
        id="cqcInspectionUrl"
        name="cqcInspectionUrl"
        label="CQC inspection link"
        hint="A link to the home's CQC inspection page."
        defaultValue={v.cqcInspectionUrl ?? ''}
        error={err('cqcInspectionUrl')}
      />
      <Checkbox
        id="isGoingConcern"
        name="isGoingConcern"
        label="Going concern"
        description="The home is being sold as an operating business."
        defaultChecked={v.isGoingConcern ?? false}
      />
    </fieldset>
  );
}

/**
 * The per-vertical subsection renderer keyed by listing type. Identifier keys (not
 * string literals) so this authoring UI names no pack slug — entitlement is decided
 * upstream (lib/packs.ts) and passed as `enabledVerticals` (EPIC-AD / G12).
 */
const SUBSECTION_BY_LISTING_TYPE: Record<
  string,
  ((props: SubsectionProps) => ReactNode) | undefined
> = {
  new_home: NewHomeFields,
  commercial: CommercialFields,
  business_transfer: BusinessTransferFields,
  care_home: CareHomeFields,
};

export function VerticalExtensionsForm({
  listingType,
  enabledVerticals,
  initial,
  errorFor,
}: VerticalExtensionsFormProps) {
  // Not a vertical listing type, or the tenant may not author it → render nothing. The
  // entitlement decision was made server-side (lib/packs.ts); this is a pure allow-list.
  if (!enabledVerticals.includes(listingType)) return null;
  const Subsection = SUBSECTION_BY_LISTING_TYPE[listingType];
  if (!Subsection) return null;

  return <>{Subsection({ v: initial ?? {}, err: (name) => errorFor?.(name) })}</>;
}
