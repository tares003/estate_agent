import { describe, expect, it } from 'vitest';
import { defineMessages, MESSAGES } from './messages.js';

describe('defineMessages', () => {
  it('returns the same map it was given (identity passthrough)', () => {
    const map = {
      'common.submit': 'Submit',
      'common.cancel': 'Cancel',
    } as const;
    const declared = defineMessages(map);
    expect(declared).toEqual(map);
  });

  it('preserves every key declared on the map', () => {
    const declared = defineMessages({
      'greeting.hello': 'Hello {name}',
      'greeting.bye': 'Goodbye',
    });
    expect(Object.keys(declared).sort()).toEqual(['greeting.bye', 'greeting.hello']);
  });

  it('infers literal key types so a known key reads back its default', () => {
    const declared = defineMessages({ 'common.required': 'This field is required' });
    // Indexing by a literal key is statically valid and returns the default.
    expect(declared['common.required']).toBe('This field is required');
  });
});

describe('MESSAGES (en-GB catalogue)', () => {
  it('carries the representative shared keys', () => {
    expect(MESSAGES['common.submit']).toBe('Submit');
    expect(MESSAGES['common.cancel']).toBe('Cancel');
    expect(MESSAGES['common.required']).toBe('This field is required');
    expect(MESSAGES['validation.email.invalid']).toBe('Enter a valid email address');
    expect(MESSAGES['validation.consent.required']).toBe('You must agree before continuing');
  });

  it('every catalogue value is a non-empty string', () => {
    const values = Object.values(MESSAGES);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('every catalogue key is a non-empty dot-notation string', () => {
    for (const key of Object.keys(MESSAGES)) {
      expect(key.length).toBeGreaterThan(0);
      expect(key).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/);
    }
  });
});
