import pino from 'pino';
import type { DestinationStream, Logger } from 'pino';

/** Options accepted by {@link createLogger}. */
export interface LoggerOptions {
  /**
   * Minimum level to emit. Falls back to the `LOG_LEVEL` env var, then `'info'`.
   * An explicit value here always wins over the environment.
   */
  level?: string;
  /** Logical name attached to every line (e.g. the worker or surface name). */
  name?: string;
  /**
   * Where the JSON lines are written. Defaults to pino's own destination
   * (stdout), which the Docker logging driver captures per CLAUDE.md §9.
   * Tests inject a capturing stream.
   */
  destination?: DestinationStream;
}

/**
 * Creates the platform's structured logger: JSON to stdout, one line per event.
 * Level resolution is `options.level` → `process.env.LOG_LEVEL` → `'info'`.
 */
export function createLogger(options: LoggerOptions = {}): Logger<string> {
  const level = options.level ?? process.env['LOG_LEVEL'] ?? 'info';
  const pinoOptions: Parameters<typeof pino>[0] =
    options.name === undefined ? { level } : { level, name: options.name };

  return options.destination === undefined
    ? pino(pinoOptions)
    : pino(pinoOptions, options.destination);
}
