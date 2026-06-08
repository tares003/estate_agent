import { it } from 'vitest';
import { makeRuleTester } from './_rule-tester.js';
import rule from './g05-gdpr-consent.js';

// G5 — GDPR-consent guard. Any Zod object schema that captures personal data
// (email, phone, name, address, postcode, DOB, NI number, …) must also capture
// an explicit consent affirmation (`gdpr_consent` / `gdprConsent`). The
// compliance lint rejects any personal-data form schema that omits it
// (CLAUDE.md §2; master spec §S.7).
it('G5 gdpr-consent: rejects personal-data Zod schemas missing a consent key', () => {
  makeRuleTester().run('@estate/gdpr-consent', rule, {
    valid: [
      // personal data present + snake_case consent affirmation
      {
        code: 'const buyerEnquirySchema = z.object({ name: z.string(), email: z.string().email(), phone: z.string(), gdpr_consent: z.literal(true) });',
      },
      // personal data present + camelCase consent affirmation
      {
        code: 'const vendorEnquirySchema = z.object({ fullName: z.string(), email: z.string().email(), gdprConsent: z.literal(true) });',
      },
      // no personal data → consent not required
      {
        code: 'const filterSchema = z.object({ minPrice: z.number(), status: z.string() });',
      },
      // not a z.object call at all
      {
        code: 'const slug = z.string().min(1);',
      },
      // a different object builder that merely happens to take an object literal
      {
        code: 'const config = makeForm.object({ email: "value" });',
      },
    ],
    invalid: [
      // canonical violation: buyer enquiry captures name/email/phone, no consent
      {
        code: 'const buyerEnquirySchema = z.object({ name: z.string(), email: z.string().email(), phone: z.string(), message: z.string() });',
        errors: [{ messageId: 'missingConsent' }],
      },
      // single personal-data key (postcode) is enough to require consent
      {
        code: 'const addressSchema = z.object({ addressLine1: z.string(), postcode: z.string() });',
        errors: [{ messageId: 'missingConsent' }],
      },
      // case-insensitive match on a personal-data key
      {
        code: 'const tenantSchema = z.object({ DateOfBirth: z.string(), nationalInsurance: z.string() });',
        errors: [{ messageId: 'missingConsent' }],
      },
    ],
  });
});
