/**
 * G10 — Sub-processor-manifest guard.
 *
 * GDPR Article 28 requires the data controller (the tenant agency) and the
 * platform operator to maintain an accurate, published list of every
 * sub-processor that handles personal data on their behalf. Master spec §S.7
 * (data residency) and the operator's sub-processor-change-notification
 * obligation depend on that list staying current.
 *
 * A PR that adds a dependency on an external service (Twilio, Stripe, SendGrid,
 * Mailgun, Segment, Sentry, Postmark, …) introduces a new sub-processor. If the
 * service is not declared in the sub-processor manifest, the change ships an
 * undisclosed data processor — a compliance breach. This guard fails closed on
 * that case: any added external-service dependency whose service name is absent
 * from the manifest is a violation.
 *
 * Pure function — no I/O, no globals. The CI wrapper supplies the list of
 * dependencies a PR added (diffed from the lockfile / package.json) and the
 * manifest entries (parsed from the published sub-processor list).
 */

/**
 * Map from an external-service npm package name to the canonical sub-processor
 * service name it represents. Several packages can map to the same service
 * (e.g. `@sendgrid/mail` and `sendgrid` both => `SendGrid`).
 *
 * Only packages that cause personal data to leave the platform to a third party
 * belong here. First-party / self-hosted dependencies (e.g. `nodemailer`,
 * `pino`, `bullmq`, `ioredis`) are NOT sub-processors and are intentionally
 * absent — adding them must not trip the guard.
 */
export const EXTERNAL_SERVICE_DEPS: Readonly<Record<string, string>> = {
  twilio: 'Twilio',
  '@sendgrid/mail': 'SendGrid',
  sendgrid: 'SendGrid',
  stripe: 'Stripe',
  'mailgun.js': 'Mailgun',
  '@segment/analytics-node': 'Segment',
  '@sentry/node': 'Sentry',
  postmark: 'Postmark',
};

/**
 * The sub-processors the committed stack (CLAUDE.md §9) already declares by
 * default: Twilio (SMS), Stripe (billing), Cloudflare (CDN / DDoS / Turnstile).
 * A manifest that lists these covers the baseline; anything beyond it must be
 * explicitly added when a new external service is introduced.
 */
export const DECLARED_DEFAULT: readonly string[] = ['Twilio', 'Stripe', 'Cloudflare'];

export interface SubProcessorViolation {
  /** The npm package name that was added. */
  dep: string;
  /** The sub-processor service name it resolves to. */
  service: string;
}

export interface SubProcessorCheckResult {
  ok: boolean;
  violations: SubProcessorViolation[];
}

/**
 * Check that every added external-service dependency is declared in the manifest.
 *
 * @param addedDeps  npm package names a PR added.
 * @param manifest   sub-processor service names the published manifest declares.
 * @returns ok=false with one violation per undeclared external service.
 */
export function checkSubProcessors(
  addedDeps: string[],
  manifest: string[],
): SubProcessorCheckResult {
  const declared = new Set(manifest.map((name) => name.toLowerCase()));
  const violations: SubProcessorViolation[] = [];

  for (const dep of addedDeps) {
    const service = EXTERNAL_SERVICE_DEPS[dep];
    // Non-external dependencies are not sub-processors — ignore them.
    if (service === undefined) continue;
    if (!declared.has(service.toLowerCase())) {
      violations.push({ dep, service });
    }
  }

  return { ok: violations.length === 0, violations };
}
