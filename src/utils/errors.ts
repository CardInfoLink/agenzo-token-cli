/** Base class for all CLI errors */
export abstract class CliError extends Error {
  abstract readonly code: string;
}

/** API business error (backend error code) */
export class ApiBusinessError extends CliError {
  readonly code = 'API_BUSINESS_ERROR';
  constructor(
    public readonly errorCode: number,
    public readonly errorMessage: string,
    public readonly statusCode: number,
  ) {
    super(`[${errorCode}] ${errorMessage}`);
  }
}

/** Network error (timeout, connection failure) */
export class NetworkError extends CliError {
  readonly code = 'NETWORK_ERROR';
  constructor(
    public readonly url: string,
    public readonly timeout?: number,
    public readonly cause?: Error,
  ) {
    const detail = cause?.message;
    let msg: string;
    if (timeout) {
      msg = `Request timed out (${timeout}ms): ${url}`;
    } else if (detail) {
      msg = `Connection failed: ${url} (${detail})`;
    } else {
      msg = `Connection failed: ${url}`;
    }
    super(msg);
  }
}

/** Authentication error (not logged in, token expired) */
export class AuthError extends CliError {
  readonly code = 'AUTH_ERROR';
  constructor(
    message: string,
    public readonly suggestion: string,
  ) {
    super(message);
  }
}

/** Configuration error (corrupted file, unwritable directory) */
export class ConfigError extends CliError {
  readonly code = 'CONFIG_ERROR';
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(message);
  }
}

/** Input validation error */
export class ValidationError extends CliError {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}

/**
 * A server-write command was invoked without the mandatory `--idempotency-key`.
 * Every command that issues a backend write requires the caller to supply an
 * idempotency key (the CLI never auto-generates one), so its absence is a local
 * input error surfaced as `PARAM_IDEMPOTENCY_KEY_REQUIRED` (exit code 1).
 */
export class IdempotencyKeyRequiredError extends CliError {
  readonly code = 'IDEMPOTENCY_KEY_REQUIRED_ERROR';
  constructor(commandPath: string) {
    super(
      `\`${commandPath}\` requires --idempotency-key <key>. ` +
        'Supply a unique key so the write can be safely retried.',
    );
  }
}

/**
 * CLI version is below the server-advertised minimum. Thrown from the API
 * client before the response body is parsed; handled by the top-level error
 * handler which exits with a non-zero code so CI/automation can detect it.
 */
export class UpgradeRequiredError extends CliError {
  readonly code = 'UPGRADE_REQUIRED';
  constructor(
    public readonly currentVersion: string,
    public readonly minVersion: string,
    public readonly upgradeCommand: string,
  ) {
    super(
      `agenzo-admin-cli ${currentVersion} is out of date — the server requires ` +
        `${minVersion} or newer. To upgrade, run: ${upgradeCommand}`,
    );
  }
}

/**
 * User cancelled the operation — SIGINT / Ctrl+C, or answering `n` at a
 * confirmation prompt. Maps to the public `USER_CANCELLED` catalog code and
 * exit code 5.
 *
 * NOTE: `code` here is the *class identifier* ('USER_CANCEL_ERROR'), matching
 * the structural check in `utils/exit.ts`. It is intentionally distinct from
 * the outward-facing `ErrorCode` catalog value ('USER_CANCELLED') below.
 */
export class UserCancelError extends CliError {
  readonly code = 'USER_CANCEL_ERROR';
  constructor(message = 'Operation cancelled by user') {
    super(message);
    // Subclasses do not inherit a useful `name` automatically; set it so
    // structural detectors (e.g. exit.ts) can recognise the class by name.
    this.name = 'UserCancelError';
  }
}

/**
 * Public, machine-readable error code emitted in the error envelope
 * (cli-standard §5.3/§10; cli-design §7.7.3 BACK-020). SCREAMING_SNAKE, drawn
 * from the domain prefixes AUTH_* / ORG_* / KEY_* / PARAM_* / RATE_* /
 * UPSTREAM_*, plus the standalone UPGRADE_REQUIRED / USER_CANCELLED /
 * INTERNAL_ERROR.
 *
 * IMPORTANT: This outward-facing catalog code is distinct from each
 * `CliError` subclass's `readonly code` (a class identifier such as
 * 'AUTH_ERROR' or 'USER_CANCEL_ERROR'). Do not conflate the two — `code` on
 * the class identifies the thrown class; `ErrorCode` is the public catalog
 * surfaced to Agents/CI in the error envelope.
 */
export type ErrorCode =
  | 'AUTH_FAILED'
  | 'AUTH_INVALID_API_KEY'
  | 'AUTH_NOT_SIGNED_IN'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_TIMEOUT'
  | 'ORG_NOT_FOUND'
  | 'ORG_CONFLICT'
  | 'KEY_NOT_FOUND'
  | 'KEY_SCOPE_DENIED'
  | 'PARAM_INVALID'
  | 'PARAM_MISSING'
  | 'PARAM_IDEMPOTENCY_KEY_REQUIRED'
  | 'PARAM_IDEMPOTENCY_KEY_CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPGRADE_REQUIRED'
  | 'USER_CANCELLED'
  | 'INTERNAL_ERROR';

/**
 * Pick the AUTH_* sub-code for an `AuthError`. The reused `AuthError` class
 * carries no structured discriminator (the split keeps AuthService logic
 * verbatim), so the trigger is inferred from the human message/suggestion:
 * magic-link timeout -> AUTH_TIMEOUT, expired/refresh failure ->
 * AUTH_SESSION_EXPIRED, otherwise the default "not signed in".
 */
function authErrorCode(error: AuthError): ErrorCode {
  const haystack = `${error.message} ${error.suggestion}`.toLowerCase();
  if (haystack.includes('timed out') || haystack.includes('timeout')) {
    return 'AUTH_TIMEOUT';
  }
  if (
    haystack.includes('expired') ||
    haystack.includes('session') ||
    haystack.includes('refresh')
  ) {
    return 'AUTH_SESSION_EXPIRED';
  }
  return 'AUTH_NOT_SIGNED_IN';
}

/**
 * Derive the public `ErrorCode` for any thrown value (cli-standard §5.3).
 *
 * Keys off `instanceof` first, then subdivides `ApiBusinessError` by HTTP
 * `statusCode`. Anything unrecognised maps to `INTERNAL_ERROR`, so the return
 * value is always a member of the `ErrorCode` union.
 *
 * Per the design's "Error class -> code -> exit-code matrix".
 */
export function errorCodeFor(error: unknown): ErrorCode {
  // instanceof checks take priority over status-code subdivision.
  if (error instanceof UpgradeRequiredError) {
    return 'UPGRADE_REQUIRED';
  }
  if (error instanceof UserCancelError) {
    return 'USER_CANCELLED';
  }
  if (error instanceof AuthError) {
    return authErrorCode(error);
  }
  if (error instanceof ValidationError) {
    return 'PARAM_INVALID';
  }
  if (error instanceof IdempotencyKeyRequiredError) {
    return 'PARAM_IDEMPOTENCY_KEY_REQUIRED';
  }
  if (error instanceof ConfigError) {
    return 'INTERNAL_ERROR';
  }
  if (error instanceof NetworkError) {
    return 'UPSTREAM_UNAVAILABLE';
  }

  // ApiBusinessError — subdivide by backend HTTP status.
  if (error instanceof ApiBusinessError) {
    const status = error.statusCode;
    if (status === 401) {
      return 'AUTH_FAILED';
    }
    if (status === 403) {
      return 'KEY_SCOPE_DENIED';
    }
    if (status === 404) {
      // Resource-specific: ORG_NOT_FOUND vs KEY_NOT_FOUND. `errorCodeFor` sees
      // only the error, not the command noun, so it defaults to ORG_NOT_FOUND;
      // a calling command may refine this when it constructs the error.
      // (design: "Resource-specific 404 is chosen by the calling command's noun.")
      return 'ORG_NOT_FOUND';
    }
    if (status === 409) {
      return 'ORG_CONFLICT';
    }
    if (status === 429) {
      return 'RATE_LIMITED';
    }
    if (status >= 500) {
      return 'UPSTREAM_UNAVAILABLE';
    }
    // Any other 4xx is a business / parameter error.
    return 'PARAM_INVALID';
  }

  // Unrecognised throwable.
  return 'INTERNAL_ERROR';
}

/**
 * Shape written to stderr on failure (cli-design §7.7.3 BACK-021).
 * `http` is the backend HTTP status, present only when the failure came from
 * an HTTP call.
 */
export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; http?: number };
}

/**
 * Build the stderr error envelope for any thrown value. `code` is always a
 * known `ErrorCode`; `message` is always non-empty. `http` is included only
 * when the failure originated from an HTTP call — `ApiBusinessError` carries
 * the backend status, whereas `NetworkError` never received a response and so
 * reports no status.
 */
export function toErrorEnvelope(error: unknown): ErrorEnvelope {
  const code = errorCodeFor(error);

  let message: string;
  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === 'string' && error.length > 0) {
    message = error;
  } else {
    message = 'Unexpected error';
  }

  const http = error instanceof ApiBusinessError ? error.statusCode : undefined;
  if (http === undefined) {
    return { error: { code, message } };
  }
  return { error: { code, message, http } };
}
