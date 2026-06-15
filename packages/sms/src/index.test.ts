import { describe, expect, it } from 'vitest';

import * as sms from './index.js';

describe('@estate/sms barrel', () => {
  it('re-exports the public surface', () => {
    expect(typeof sms.TwilioSmsBackend).toBe('function');
    expect(typeof sms.SmsError).toBe('function');
    expect(typeof sms.resolveSmsBackend).toBe('function');
  });
});
