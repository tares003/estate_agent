import { describe, it, expect } from 'vitest';
import {
  EXTERNAL_SERVICE_DEPS,
  DECLARED_DEFAULT,
  checkSubProcessors,
} from './g10-sub-processor-manifest.js';

// G10 — Sub-processor-manifest guard.
//
// Per master spec §S.7 (data residency) and the GDPR Article 28 sub-processor
// disclosure obligation, every third-party service that processes personal data
// on the platform's behalf MUST be declared in the sub-processor manifest. When
// a PR adds a dependency on an external service (Twilio, Stripe, SendGrid, …),
// that service has to be present in the manifest, otherwise the change ships an
// undisclosed sub-processor. This guard fails closed on that case.
describe('G10 sub-processor manifest guard', () => {
  it('maps known external-service npm packages to their sub-processor names', () => {
    // sanity: the map keys all resolve to non-empty service names
    for (const [dep, service] of Object.entries(EXTERNAL_SERVICE_DEPS)) {
      expect(typeof dep).toBe('string');
      expect(service.length).toBeGreaterThan(0);
    }
    // the committed-stack defaults (CLAUDE.md §9) are present in the map
    expect(EXTERNAL_SERVICE_DEPS['twilio']).toBe('Twilio');
    expect(EXTERNAL_SERVICE_DEPS['stripe']).toBe('Stripe');
  });

  it('declares the committed-stack default sub-processors', () => {
    expect(DECLARED_DEFAULT).toEqual(expect.arrayContaining(['Twilio', 'Stripe', 'Cloudflare']));
  });

  // CLEAN case — a dependency on an external service that IS declared passes.
  it('passes when an added external-service dependency is already declared', () => {
    const result = checkSubProcessors(['sendgrid'], ['Twilio', 'Stripe', 'Cloudflare', 'SendGrid']);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  // CLEAN case — declaration match is case-insensitive.
  it('matches the manifest case-insensitively', () => {
    const result = checkSubProcessors(['stripe'], ['twilio', 'STRIPE', 'cloudflare']);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  // CLEAN case — non-external dependencies are ignored entirely.
  it('ignores non-external dependencies', () => {
    const result = checkSubProcessors(['lodash', 'date-fns'], ['Twilio']);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  // CLEAN case — the committed defaults need no extra manifest beyond DECLARED_DEFAULT.
  it('passes when adding a committed default dependency against the default manifest', () => {
    const result = checkSubProcessors(
      ['twilio', '@sendgrid/mail'],
      [...DECLARED_DEFAULT, 'SendGrid'],
    );
    expect(result.ok).toBe(true);
  });

  // DELIBERATE-VIOLATION case — an undeclared external service must be REJECTED.
  it('rejects an added external-service dependency that is undeclared (fail-closed)', () => {
    const result = checkSubProcessors(['sendgrid'], ['Twilio', 'Stripe', 'Cloudflare']);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ dep: 'sendgrid', service: 'SendGrid' }]);
  });

  // DELIBERATE-VIOLATION case — multiple undeclared services all reported; the
  // declared one is not flagged.
  it('reports every undeclared external service while allowing declared ones', () => {
    const result = checkSubProcessors(
      ['stripe', 'mailgun.js', '@segment/analytics-node', 'lodash'],
      ['Stripe'],
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { dep: 'mailgun.js', service: 'Mailgun' },
      { dep: '@segment/analytics-node', service: 'Segment' },
    ]);
  });
});
