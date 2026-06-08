import { describe, expect, it } from 'vitest';
import { repairRequestSchema } from './repair-request.js';

/** A deterministic, fully-valid repair-request submission. */
function validFixture() {
  return {
    name: 'Delia Dormouse',
    email: 'dormouse@example.invalid',
    phone: '07911123456',
    propertyReference: 'REF-DORMOUSE-003',
    category: 'plumbing',
    description: 'The kitchen tap is dripping continuously.',
    urgency: 'standard' as const,
    gdpr_consent: true as const,
  };
}

/** Return a shallow copy of the fixture with one key removed. */
function omit(key: keyof ReturnType<typeof validFixture>) {
  const copy: Record<string, unknown> = { ...validFixture() };
  delete copy[key];
  return copy;
}

describe('repairRequestSchema', () => {
  it('parses a valid fixture', () => {
    expect(repairRequestSchema.safeParse(validFixture()).success).toBe(true);
  });

  it('accepts every urgency taxonomy value', () => {
    for (const urgency of ['emergency', 'urgent', 'standard', 'low'] as const) {
      expect(repairRequestSchema.safeParse({ ...validFixture(), urgency }).success).toBe(true);
    }
  });

  it('rejects an urgency outside the taxonomy', () => {
    expect(repairRequestSchema.safeParse({ ...validFixture(), urgency: 'whenever' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid email', () => {
    expect(
      repairRequestSchema.safeParse({ ...validFixture(), email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('rejects a false gdpr_consent', () => {
    expect(repairRequestSchema.safeParse({ ...validFixture(), gdpr_consent: false }).success).toBe(
      false,
    );
  });

  it('rejects a missing gdpr_consent', () => {
    expect(repairRequestSchema.safeParse(omit('gdpr_consent')).success).toBe(false);
  });

  it('rejects a missing name', () => {
    expect(repairRequestSchema.safeParse(omit('name')).success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(repairRequestSchema.safeParse(omit('email')).success).toBe(false);
  });

  it('rejects a missing phone', () => {
    expect(repairRequestSchema.safeParse(omit('phone')).success).toBe(false);
  });

  it('rejects a missing propertyReference', () => {
    expect(repairRequestSchema.safeParse(omit('propertyReference')).success).toBe(false);
  });

  it('rejects a missing category', () => {
    expect(repairRequestSchema.safeParse(omit('category')).success).toBe(false);
  });

  it('rejects a missing description', () => {
    expect(repairRequestSchema.safeParse(omit('description')).success).toBe(false);
  });

  it('rejects a missing urgency', () => {
    expect(repairRequestSchema.safeParse(omit('urgency')).success).toBe(false);
  });
});
