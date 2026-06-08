import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DestinationStream } from 'pino';
import { createLogger } from './logger.js';

/** Captures every line pino writes so tests can assert on the JSON payload. */
function captureStream(): DestinationStream & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    write(msg: string): void {
      lines.push(msg);
    },
  };
}

describe('createLogger', () => {
  const original = process.env['LOG_LEVEL'];

  beforeEach(() => {
    delete process.env['LOG_LEVEL'];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env['LOG_LEVEL'];
    } else {
      process.env['LOG_LEVEL'] = original;
    }
  });

  it('writes structured JSON containing the message and level label', () => {
    const dest = captureStream();
    const log = createLogger({ destination: dest });

    log.info('property published');

    expect(dest.lines).toHaveLength(1);
    const entry = JSON.parse(dest.lines[0]!) as Record<string, unknown>;
    expect(entry['msg']).toBe('property published');
    // pino encodes info as numeric level 30 by default.
    expect(entry['level']).toBe(30);
    expect(typeof entry['time']).toBe('number');
  });

  it('includes the name when provided', () => {
    const dest = captureStream();
    const log = createLogger({ name: 'enquiry-worker', destination: dest });

    log.warn('retrying enquiry delivery');

    const entry = JSON.parse(dest.lines[0]!) as Record<string, unknown>;
    expect(entry['name']).toBe('enquiry-worker');
    expect(entry['level']).toBe(40);
  });

  it('respects the level option — entries below the threshold are dropped', () => {
    const dest = captureStream();
    const log = createLogger({ level: 'warn', destination: dest });

    log.info('this should be filtered out');
    log.error('viewing booking failed');

    expect(dest.lines).toHaveLength(1);
    const entry = JSON.parse(dest.lines[0]!) as Record<string, unknown>;
    expect(entry['msg']).toBe('viewing booking failed');
    expect(entry['level']).toBe(50);
  });

  it('reads the level from LOG_LEVEL when no option is given', () => {
    process.env['LOG_LEVEL'] = 'error';
    const dest = captureStream();
    const log = createLogger({ destination: dest });

    expect(log.level).toBe('error');
    log.warn('dropped by env threshold');
    expect(dest.lines).toHaveLength(0);
  });

  it('defaults to info when neither an option nor LOG_LEVEL is set', () => {
    const dest = captureStream();
    const log = createLogger({ destination: dest });

    expect(log.level).toBe('info');
  });

  it('prefers the explicit level option over LOG_LEVEL', () => {
    process.env['LOG_LEVEL'] = 'error';
    const dest = captureStream();
    const log = createLogger({ level: 'debug', destination: dest });

    expect(log.level).toBe('debug');
  });

  it('can be constructed with no options', () => {
    const log = createLogger();
    expect(log.level).toBe('info');
  });
});
