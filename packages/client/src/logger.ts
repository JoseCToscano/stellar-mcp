/** Log levels ordered by verbosity */
export const LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/** Prefix for all SDK log messages */
const LOG_PREFIX = '[@stellar-mcp/client]';

/**
 * Simple structured logger for the SDK.
 *
 * Default level is 'silent' (no output) — enable by passing `logLevel`
 * or calling `logger.setLevel('debug')`.
 *
 * @example
 * ```ts
 * logger.setLevel('debug');
 * logger.info('Connected to MCP server', { url });
 * logger.debug('Tool response', { toolName, data });
 * ```
 */
class Logger {
  private level: number = LOG_LEVELS.silent;

  /** Set the active log level */
  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  /** Get the current log level name */
  getLevel(): LogLevel {
    const entries = Object.entries(LOG_LEVELS) as [LogLevel, number][];
    const match = entries.find(([, value]) => value === this.level);
    return match?.[0] ?? 'silent';
  }

  /** Log an error message (always visible unless silent) */
  error(message: string, context?: Record<string, unknown>): void {
    if (this.level >= LOG_LEVELS.error) {
      console.error(LOG_PREFIX, message, context ?? '');
    }
  }

  /** Log a warning message */
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.level >= LOG_LEVELS.warn) {
      console.warn(LOG_PREFIX, message, context ?? '');
    }
  }

  /** Log an informational message */
  info(message: string, context?: Record<string, unknown>): void {
    if (this.level >= LOG_LEVELS.info) {
      console.info(LOG_PREFIX, message, context ?? '');
    }
  }

  /** Log a debug message (most verbose) */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.level >= LOG_LEVELS.debug) {
      console.debug(LOG_PREFIX, message, context ?? '');
    }
  }
}

/** Singleton logger instance for the SDK */
export const logger = new Logger();
