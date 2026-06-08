import { describe, expect, it } from 'vitest';
import {
  CollectingErrorReporter,
  NoopErrorReporter,
  type ErrorReporter,
} from './error-reporter.js';

describe('NoopErrorReporter', () => {
  it('does not throw when capturing an error with context', () => {
    const reporter: ErrorReporter = new NoopErrorReporter();
    expect(() => {
      reporter.capture(new Error('boom'), { tenantId: 't-1' });
    }).not.toThrow();
  });

  it('does not throw when capturing without context', () => {
    const reporter = new NoopErrorReporter();
    expect(() => {
      reporter.capture('a non-error value');
    }).not.toThrow();
  });
});

describe('CollectingErrorReporter', () => {
  it('records the captured error and its context', () => {
    const reporter = new CollectingErrorReporter();
    const error = new Error('valuation sync failed');

    reporter.capture(error, { tenantId: 't-7', propertyId: 'p-3' });

    expect(reporter.captured).toHaveLength(1);
    expect(reporter.captured[0]!.error).toBe(error);
    expect(reporter.captured[0]!.context).toEqual({
      tenantId: 't-7',
      propertyId: 'p-3',
    });
  });

  it('records undefined context when none is supplied', () => {
    const reporter = new CollectingErrorReporter();

    reporter.capture('string failure');

    expect(reporter.captured).toHaveLength(1);
    expect(reporter.captured[0]!.error).toBe('string failure');
    expect(reporter.captured[0]!.context).toBeUndefined();
  });

  it('accumulates multiple captures in order', () => {
    const reporter = new CollectingErrorReporter();
    const first = new Error('first');
    const second = new Error('second');

    reporter.capture(first);
    reporter.capture(second, { agentId: 'a-1' });

    expect(reporter.captured.map((c) => c.error)).toEqual([first, second]);
    expect(reporter.captured[1]!.context).toEqual({ agentId: 'a-1' });
  });

  it('starts empty', () => {
    const reporter = new CollectingErrorReporter();
    expect(reporter.captured).toHaveLength(0);
  });
});
