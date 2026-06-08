import { describe, expect, it } from 'vitest';

import * as api from './index.js';

describe('@estate/email public API', () => {
  it('re-exports the credential codec, mailer and transport resolver', () => {
    expect(typeof api.encryptCredentials).toBe('function');
    expect(typeof api.decryptCredentials).toBe('function');
    expect(typeof api.NodemailerMailer).toBe('function');
    expect(typeof api.resolveTransport).toBe('function');
  });
});
