/**
 * SCREAMING_SNAKE_CASE error codes shared across the CLI. Server-returned
 * codes are passed through verbatim; this catalog is the well-known set the
 * CLI itself raises, special-cases, or recognizes from the backend so that
 * agents (and the schema `error_recovery` blocks) never reference an orphan
 * code. Codes are grouped by origin.
 */
export const ErrorCodes = {
  // -- Ride/elife domain (raised by the backend, recognized here) --
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  VEHICLE_UNAVAILABLE: 'VEHICLE_UNAVAILABLE',
  BOOKING_FAILED: 'BOOKING_FAILED',
  CANCELLATION_NOT_ALLOWED: 'CANCELLATION_NOT_ALLOWED',

  // -- Billing / settlement-account (monthly_settlement) --
  BILLING_MODE_MISMATCH: 'BILLING_MODE_MISMATCH',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_INSUFFICIENT_BALANCE: 'ACCOUNT_INSUFFICIENT_BALANCE',

  // -- Payment order (pay_per_call; reserved until payment-cli ships) --
  PAYMENT_ORDER_NOT_FOUND: 'PAYMENT_ORDER_NOT_FOUND',
  PAYMENT_ORDER_NOT_PAID: 'PAYMENT_ORDER_NOT_PAID',
  PAYMENT_ORDER_MISMATCH: 'PAYMENT_ORDER_MISMATCH',
  PAYMENT_ORDER_ALREADY_CONSUMED: 'PAYMENT_ORDER_ALREADY_CONSUMED',

  // -- Parameter / idempotency --
  PARAM_IDEMPOTENCY_KEY_REQUIRED: 'PARAM_IDEMPOTENCY_KEY_REQUIRED',
  PARAM_IDEMPOTENCY_KEY_CONFLICT: 'PARAM_IDEMPOTENCY_KEY_CONFLICT',

  // -- Service discovery --
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',

  // -- CLI-local / transport --
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CLI_OUTDATED: 'CLI_OUTDATED',
  CONFIG_ERROR: 'CONFIG_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
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
