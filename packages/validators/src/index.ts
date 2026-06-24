/**
 * @estate/validators — public surface.
 *
 * Zod input-validation schemas for the public forms, shared between client
 * (React Hook Form + zodResolver) and server (Server Action validation). Every
 * personal-data schema carries a `gdpr_consent` affirmation (CI guard G5).
 *
 * Re-exports every schema, its inferred type, and the shared field helpers.
 */

export {
  email,
  gdprConsent,
  nonEmptyString,
  password,
  PASSWORD_MIN_LENGTH,
  ukPhone,
  ukPostcode,
} from './fields.js';

export {
  COOKIE_CONSENT_CATEGORIES,
  NON_ESSENTIAL_COOKIE_CATEGORIES,
  cookieConsentSchema,
  type CookieConsentCategory,
  type CookieConsentDecision,
} from './cookie-consent.js';

export { buyerEnquirySchema, type BuyerEnquiry } from './buyer-enquiry.js';
export {
  customerRegistrationSchema,
  type CustomerRegistration,
} from './customer-registration.js';
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
export { savedPropertyToggleSchema, type SavedPropertyToggle } from './saved-property.js';
export {
  IMAGE_CONTENT_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MAX_BYTES,
  propertyImageMetaSchema,
  propertyImageUploadSchema,
  type ImageContentType,
  type PropertyImageMeta,
  type PropertyImageUpload,
} from './image-upload.js';
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
export {
  REPAIR_FILE_CONTENT_TYPES,
  REPAIR_FILE_EXTENSIONS,
  REPAIR_FILE_MAX_BYTES,
  REPAIR_MAX_FILES,
  repairFileMetaSchema,
  repairFilesMetaSchema,
  type RepairFileContentType,
  type RepairFileMeta,
} from './repair-file.js';
export { DEFAULT_REPAIR_CATEGORIES, type DefaultRepairCategory } from './repair-category.js';
export { mortgageInputSchema, type MortgageInput } from './mortgage.js';
export {
  mortgageRateConfigSchema,
  type MortgageRateConfigInput,
} from './mortgage-rate-config.js';
export {
  SDLT_BUYER_CATEGORIES,
  stampDutyInputSchema,
  type SdltBuyerCategory,
  type StampDutyInput,
} from './stamp-duty.js';
export { sdltConfigSchema, type SdltConfigInput } from './sdlt-config.js';
export {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_DECISIONS,
  feedbackSubmissionSchema,
  feedbackModerationSchema,
  feedbackDecisionStatus,
  type FeedbackSubmission,
  type FeedbackDecision,
  type FeedbackModeration,
} from './feedback.js';
export {
  ASSIGNMENT_RULE_CONDITION_FIELDS,
  ASSIGNMENT_RULE_OPERATORS,
  ASSIGNMENT_RULE_NAME_MAX,
  ASSIGNMENT_TARGET_TYPES,
  assignmentConditionSchema,
  assignmentTargetSchema,
  assignmentRuleSchema,
  matchesAllConditions,
  evaluateAssignmentRules,
  type AssignmentRuleConditionField,
  type AssignmentRuleOperator,
  type AssignmentTargetType,
  type AssignmentCondition,
  type AssignmentTarget,
  type AssignmentRule,
  type SampleEnquiry,
  type AssignmentEvaluation,
} from './assignment-rule.js';
