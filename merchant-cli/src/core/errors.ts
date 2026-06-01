/**
 * SCREAMING_SNAKE_CASE error codes shared across the CLI. Server-returned
 * codes are passed through verbatim, so this list is the well-known subset the
 * CLI itself raises or special-cases.
 */
export const ErrorCodes = {
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  VEHICLE_UNAVAILABLE: 'VEHICLE_UNAVAILABLE',
  BOOKING_FAILED: 'BOOKING_FAILED',
  CANCELLATION_NOT_ALLOWED: 'CANCELLATION_NOT_ALLOWED',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  PARAM_IDEMPOTENCY_KEY_REQUIRED: 'PARAM_IDEMPOTENCY_KEY_REQUIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CLI_OUTDATED: 'CLI_OUTDATED',
  CONFIG_ERROR: 'CONFIG_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Single error type for the CLI. `code` identifies the failure class,
 * `recovery` is an optional human-readable next step, and `exitCode` lets
 * specific failures (e.g. CLI_OUTDATED) signal a distinct process exit code.
 */
export class CliError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly recovery?: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
