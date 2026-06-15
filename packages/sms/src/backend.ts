/**
 * Operator-level SMS abstraction (CLAUDE.md §9). One implementation ships —
 * Twilio — but feature code depends only on this interface so the provider can
 * be swapped without touching call-sites, and so tests inject a fake. Numbers
 * are E.164; the body is plain text.
 */
export interface SmsBackend {
  /** Send `body` to `to` (E.164). Resolves with the provider message id; throws on failure. */
  send(to: string, body: string): Promise<{ sid: string }>;
}

/** Error raised by an {@link SmsBackend} for any send failure. */
export class SmsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SmsError';
  }
}
