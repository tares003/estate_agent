import type { CandidateProperty } from './saved-search-match.js';

// §F.5 confidential / §J hideExactAddress — the alert-email twin of the PUBLIC
// address-redaction rule in apps/web app/(app)/lib/properties.ts (publicTitle /
// publicAddressLine / redactedAddressLine / publicPostcodePrefix). An alert email
// is a public surface: whatever the catalogue and detail page redact, the email
// must redact identically. The web module cannot be imported across apps, so this
// twin re-expresses the same semantics; alert-redaction.test.ts pins them.

/** The redaction inputs an alert render needs (a CandidateProperty satisfies it). */
type RedactableProperty = Pick<
  CandidateProperty,
  | 'title'
  | 'displayAddress'
  | 'postcode'
  | 'postcodePrefix'
  | 'town'
  | 'isConfidential'
  | 'hideExactAddress'
>;

/**
 * Whether the alert must redact this row's exact address — same rule as the
 * public surface: either flag redacts, fail closed on any listing type.
 */
export function isAlertAddressRedacted(property: RedactableProperty): boolean {
  return property.hideExactAddress === true || property.isConfidential === true;
}

/** The public-safe postcode prefix: the stored prefix, else the first postcode token. */
function alertPostcodePrefix(property: RedactableProperty): string {
  if (property.postcodePrefix) return property.postcodePrefix;
  return property.postcode.trim().split(/\s+/)[0] ?? '';
}

/** The non-identifying placeholder rendered instead of the exact address: "town, prefix". */
function redactedAlertAddressLine(property: RedactableProperty): string {
  const prefix = alertPostcodePrefix(property);
  if (!property.town) return prefix;
  return prefix ? `${property.town}, ${prefix}` : property.town;
}

/**
 * The alert title: a confidential listing hides even an explicit title (it may
 * name the business — §F.5); otherwise the title when present, else the exact or
 * redacted address line depending on the flags. Mirrors the web publicTitle.
 */
export function alertTitle(property: RedactableProperty): string {
  if (property.isConfidential === true) return redactedAlertAddressLine(property);
  if (property.title) return property.title;
  return isAlertAddressRedacted(property)
    ? redactedAlertAddressLine(property)
    : property.displayAddress;
}

/** The alert address line: exact "displayAddress, postcode", or the redacted placeholder. */
export function alertAddressLine(property: RedactableProperty): string {
  return isAlertAddressRedacted(property)
    ? redactedAlertAddressLine(property)
    : `${property.displayAddress}, ${property.postcode}`;
}
