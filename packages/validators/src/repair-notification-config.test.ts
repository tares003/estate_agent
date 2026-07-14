import { describe, expect, it } from 'vitest';

import { repairNotificationConfigSchema } from './repair-notification-config.js';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the admin-editable repair notification routing config: the internal recipients
// §G.7 routes new-ticket notifications to. Either channel may be unconfigured
// (null); a configured value must be a well-formed email / UK phone.

describe('repairNotificationConfigSchema', () => {
  it('accepts a full config, normalising the email', () => {
    const parsed = repairNotificationConfigSchema.parse({
      repairsEmail: '  Repairs@Agency.Example ',
      onCallPhone: '07700 900123',
    });
    expect(parsed.repairsEmail).toBe('repairs@agency.example');
    expect(parsed.onCallPhone).toBe('07700 900123');
  });

  it('accepts null for an unconfigured channel', () => {
    const parsed = repairNotificationConfigSchema.parse({
      repairsEmail: null,
      onCallPhone: null,
    });
    expect(parsed).toEqual({ repairsEmail: null, onCallPhone: null });
  });

  it('rejects a malformed repairs-queue email', () => {
    const result = repairNotificationConfigSchema.safeParse({
      repairsEmail: 'not-an-email',
      onCallPhone: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed on-call phone number', () => {
    const result = repairNotificationConfigSchema.safeParse({
      repairsEmail: null,
      onCallPhone: '12',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing either key (explicit shape, no silent drops)', () => {
    expect(repairNotificationConfigSchema.safeParse({ repairsEmail: null }).success).toBe(false);
    expect(repairNotificationConfigSchema.safeParse({ onCallPhone: null }).success).toBe(false);
  });
});
