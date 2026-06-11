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
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_TRANSITIONS,
  LOST_REASONS,
  canTransition,
  enquiryStatusUpdateSchema,
  type EnquiryStatus,
  type EnquiryStatusUpdate,
  type LostReason,
} from './enquiry-status.js';
export { enquiryNoteCreateSchema, type EnquiryNoteCreate } from './enquiry-note.js';
export { propertyUpdateSchema, type PropertyUpdate } from './property-update.js';
export {
  MARKET_STATUSES,
  marketStatusUpdateSchema,
  type MarketStatus,
  type MarketStatusUpdate,
} from './market-status.js';
export {
  REPAIR_STATUSES,
  REPAIR_STATUS_TRANSITIONS,
  canRepairTransition,
  repairStatusUpdateSchema,
  type RepairStatus,
  type RepairStatusUpdate,
} from './repair-status.js';
export { repairPropertyLinkSchema, type RepairPropertyLink } from './repair-property.js';
export {
  CONTACT_TYPES,
  enquiryConversionSchema,
  type ContactType,
  type EnquiryConversion,
} from './contact-type.js';
export {
  propertySearchSchema,
  parsePropertySearch,
  radiusToMetres,
  PROPERTY_SORTS,
  LISTING_TYPES,
  RADIUS_UNITS,
  DEFAULT_PAGE_SIZE,
  type PropertySearch,
  type PropertySort,
  type ListingTypeFilter,
  type RadiusUnit,
} from './property-search.js';
