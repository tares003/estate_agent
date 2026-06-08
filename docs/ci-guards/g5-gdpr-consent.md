# G5 — GDPR consent on personal-data forms

**Catches:** a form-input validation schema that captures personal data without a consent affirmation (`PRODUCT.md` §6 rule 1 / §8 / DoD item 5).

**Enforced by:** the ESLint rule `estate/gdpr-consent` (`packages/config/plugin/rules/g05-gdpr-consent.js`, messageId `missingConsent`).

**Trigger:** a `z.object({ ... })` schema whose keys include a personal-data field — `email`, `phone`, `telephone`, `mobile`, `name`, `firstName`, `lastName`, `fullName`, `address`, `addressLine1`, `postcode`/`postCode`, `dob`, `dateOfBirth`, `nationalInsurance` (case-insensitive) — must also include a `gdpr_consent` (or `gdprConsent`) key.

**How to satisfy:** add the consent affirmation to the schema, and record it server-side with `recordConsent(scope, payload)`:

```ts
export const buyerEnquirySchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  gdpr_consent: z.literal(true),
});
```

**Canonical violation → fix:** the same schema without `gdpr_consent` fails; adding `gdpr_consent: z.literal(true)` passes. Schemas with no personal data (e.g. a filter schema) are never flagged.
