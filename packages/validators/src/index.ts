/**
 * @estate/validators — public surface.
 *
 * Zod input-validation schemas for the public forms, shared between client
 * (React Hook Form + zodResolver) and server (Server Action validation). Every
 * personal-data schema carries a `gdpr_consent` affirmation (CI guard G5).
 *
 * Re-exports every schema, its inferred type, and the shared field helpers.
 */

export { email, gdprConsent, nonEmptyString, ukPhone, ukPostcode } from './fields.js';

export { buyerEnquirySchema, type BuyerEnquiry } from './buyer-enquiry.js';
export { viewingRequestSchema, type ViewingRequest } from './viewing-request.js';
export { valuationRequestSchema, type ValuationRequest } from './valuation-request.js';
export {
  repairRequestSchema,
  repairUrgency,
  type RepairRequest,
  type RepairUrgency,
} from './repair-request.js';
export {
  propertySearchSchema,
  parsePropertySearch,
  PROPERTY_SORTS,
  LISTING_TYPES,
  DEFAULT_PAGE_SIZE,
  type PropertySearch,
  type PropertySort,
  type ListingTypeFilter,
} from './property-search.js';
