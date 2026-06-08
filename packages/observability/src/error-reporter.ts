/**
 * The error-reporting seam (CLAUDE.md §9). V1 ships a no-op; a Sentry- or
 * GlitchTip-backed implementation can be swapped in later without touching
 * feature code that depends only on this interface.
 */
export interface ErrorReporter {
  /** Report a captured error with optional structured context. */
  capture(error: unknown, context?: Record<string, unknown>): void;
}

/** The V1 default: discards everything. Wiring point for a real backend later. */
export class NoopErrorReporter implements ErrorReporter {
  capture(error: unknown, context?: Record<string, unknown>): void {
    // Intentionally discards both arguments — error reporting is deferred from
    // V1. The `void` keeps the no-op explicit without an eslint-disable comment.
    void error;
    void context;
  }
}

/** A single captured report held by {@link CollectingErrorReporter}. */
export interface CapturedError {
  error: unknown;
  context?: Record<string, unknown>;
}

/**
 * Records every captured error in memory so tests and local dev can assert on
 * what was reported. Not for production use.
 */
export class CollectingErrorReporter implements ErrorReporter {
  readonly captured: CapturedError[] = [];

  capture(error: unknown, context?: Record<string, unknown>): void {
    this.captured.push(context === undefined ? { error } : { error, context });
  }
}
