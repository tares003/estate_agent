import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENQUIRY_CONSENT_TEXT } from './consent-text.js';

// Real @estate/validators (buyerEnquirySchema) drives validation; only the data
// layer + request context are doubled so the action is exercised in isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const recordConsent = vi.fn();
const audit = vi.fn();
const enquiryCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { create: enquiryCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent }));

const { submitEnquiry } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

const validFields: Record<string, string> = {
  name: 'Penelope Pomegranate',
  email: 'Penelope@Example.com',
  phone: '07700 900123',
  message: 'Is the Palatine Road semi still available to view?',
  propertyId: 'prop-1',
  gdpr_consent: 'on',
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  enquiryCreate.mockResolvedValue({ id: 'enq-1' });
});

describe('submitEnquiry', () => {
  it('persists the enquiry inside the tenant scope and returns ok', async () => {
    const result = await submitEnquiry({ ok: false }, form(validFields));

    expect(result).toEqual({ ok: true });
    expect(withTenant).toHaveBeenCalledWith({}, TENANT, expect.any(Function));
    expect(enquiryCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        propertyId: 'prop-1',
        name: 'Penelope Pomegranate',
        email: 'penelope@example.com',
        phone: '07700 900123',
        message: 'Is the Palatine Road semi still available to view?',
      },
    });
  });

  it('records the exact consent affirmation against the subject (G5)', async () => {
    await submitEnquiry({ ok: false }, form(validFields));

    expect(recordConsent).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      scope: 'enquiry_form',
      subject: 'penelope@example.com',
      consentText: ENQUIRY_CONSENT_TEXT,
      ipAddress: '203.0.113.7',
    });
  });

  it('writes an audit row for the created enquiry (G4)', async () => {
    await submitEnquiry({ ok: false }, form(validFields));

    expect(audit).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      actor: 'enquiry:penelope@example.com',
      action: 'enquiry.created',
      entity: 'enquiry',
      entityId: 'enq-1',
      ip: '203.0.113.7',
    });
  });

  it('rejects a submission with no consent and writes nothing', async () => {
    const result = await submitEnquiry({ ok: false }, form({ ...validFields, gdpr_consent: '' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'gdpr_consent' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
    expect(enquiryCreate).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('surfaces a field-linked error for an invalid email', async () => {
    const result = await submitEnquiry(
      { ok: false },
      form({ ...validFields, email: 'not-an-email' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('treats a blank optional phone as absent and still succeeds', async () => {
    const result = await submitEnquiry({ ok: false }, form({ ...validFields, phone: '   ' }));

    expect(result).toEqual({ ok: true });
    expect(enquiryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null }) }),
    );
  });

  it('handles an enquiry with no phone and no property, nulling both', async () => {
    const result = await submitEnquiry(
      { ok: false },
      form({
        name: 'Quincy Quail',
        email: 'quincy@example.com',
        message: 'Please call me about rentals in the area.',
        gdpr_consent: 'on',
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(enquiryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null, propertyId: null }) }),
    );
  });
});
