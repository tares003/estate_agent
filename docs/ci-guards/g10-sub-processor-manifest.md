# G10 — Sub-processor manifest for new external deps

**Catches:** a newly-added runtime dependency on an external service whose sub-processor is not declared in the published manifest (`PRODUCT.md` §6 rule 10 / master spec §S; GDPR Art. 28).

**Enforced by:** `packages/config/guards/g10-sub-processor-manifest.ts` (`checkSubProcessors`, `EXTERNAL_SERVICE_DEPS`), run in CI by `guards/run-all.ts`, which diffs changed `package.json` files for added dependencies and checks them against `docs/sub-processors.json`.

**Recognised external-service packages → service:** `twilio` → Twilio · `@sendgrid/mail`/`sendgrid` → SendGrid · `stripe` → Stripe · `mailgun.js` → Mailgun · `@segment/analytics-node` → Segment · `@sentry/node` → Sentry · `postmark` → Postmark. First-party / self-hosted deps (`nodemailer`, `pino`, `bullmq`, `ioredis`, …) are **not** sub-processors and never trip the guard.

**Declared baseline (`docs/sub-processors.json`):** Twilio, Stripe, Cloudflare.

**How to satisfy:** before (or with) adding an external-service dependency, add the service to `docs/sub-processors.json` (`name`, `purpose`, `region`, `dataShared`) and to the human-readable sub-processor page surfaced from the privacy policy; notify tenant administrators per the change-notification obligation.

**Canonical violation → fix:** adding `sendgrid` while the manifest lists only Twilio/Stripe/Cloudflare fails; adding a `SendGrid` entry to the manifest passes.
