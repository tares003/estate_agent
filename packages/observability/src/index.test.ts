import { describe, expect, it } from 'vitest';
import { CollectingErrorReporter, NoopErrorReporter, createLogger } from './index.js';

// The barrel is the package entry point. This proves every runtime export is
// re-exported and wired, which also covers the re-export statements.
describe('@estate/observability barrel', () => {
  it('re-exports createLogger as a working factory', () => {
    const log = createLogger();
    expect(typeof log.info).toBe('function');
    expect(log.level).toBe('info');
  });

  it('re-exports NoopErrorReporter', () => {
    const reporter = new NoopErrorReporter();
    expect(() => {
      reporter.capture(new Error('barrel-check'));
    }).not.toThrow();
  });

  it('re-exports CollectingErrorReporter', () => {
    const reporter = new CollectingErrorReporter();
    reporter.capture(new Error('barrel-check'));
    expect(reporter.captured).toHaveLength(1);
  });
});
