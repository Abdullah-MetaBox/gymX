/** Structured logging. JSON in production so a log aggregator can read it; readable in development. */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: ' INFO',
  warn: ' WARN',
  error: 'ERROR',
};

export function createLogger(base: Record<string, unknown> = {}): Logger {
  const json = process.env.NODE_ENV === 'production';

  function emit(level: LogLevel, message: string, fields?: Record<string, unknown>) {
    const payload = { level, message, time: new Date().toISOString(), ...base, ...fields };
    const stream = level === 'error' || level === 'warn' ? console.error : console.log;

    if (json) {
      stream(JSON.stringify(payload));
      return;
    }

    const extras = { ...base, ...fields };
    const suffix = Object.keys(extras).length
      ? ` ${Object.entries(extras)
          .map(([key, value]) => `${key}=${format(value)}`)
          .join(' ')}`
      : '';
    stream(`${LEVEL_LABEL[level]} ${message}${suffix}`);
  }

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

function format(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}
