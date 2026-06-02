/**
 * Exit-code mapper.
 *
 * Maps any thrown error reaching the top-level handler to one of the CLI's
 * non-zero exit codes (cli-standard §5.4). Normal completion implies `0` and
 * never consults this module.
 *
 *   1 — business / param (4xx): ApiBusinessError 4xx (except 401/403),
 *       ValidationError, ConfigError, and unknown errors
 *   2 — upgrade required: UpgradeRequiredError
 *   3 — auth-fail / invalid-key / scope denied: AuthError, ApiBusinessError 401/403
 *   4 — network / 5xx: NetworkError, ApiBusinessError 5xx
 *   5 — user-cancel: UserCancelError / SIGINT
 *
 * Pure function, no I/O.
 */
import {
  ApiBusinessError,
  AuthError,
  ConfigError,
  IdempotencyKeyRequiredError,
  NetworkError,
  UpgradeRequiredError,
  ValidationError,
} from './errors.js';

/**
 * Detect a user-cancel error without a hard dependency on `UserCancelError`.
 * That subclass is introduced by task 5.3 and may not exist when this module
 * is compiled, so we match on the conventional `code` field / class name. Once
 * `UserCancelError` lands (with `code = 'USER_CANCEL_ERROR'`) this keeps working.
 */
function isUserCancel(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const name = (error as { name?: unknown }).name;
  return code === 'USER_CANCEL_ERROR' || name === 'UserCancelError';
}

/** Map a thrown error to an exit code in the 1–5 range. */
export function exitCodeFor(error: unknown): 1 | 2 | 3 | 4 | 5 {
  // instanceof checks take priority over status-code subdivision.

  // 2 — CLI is below the server-advertised minimum version.
  if (error instanceof UpgradeRequiredError) {
    return 2;
  }

  // 3 — auth failure (not signed in, session expired, magic-link timeout).
  if (error instanceof AuthError) {
    return 3;
  }

  // 5 — user cancelled (Ctrl+C / `n` at a prompt). UserCancelError may not be
  // importable yet, so detect it structurally.
  if (isUserCancel(error)) {
    return 5;
  }

  // 4 — network timeout / connection failure.
  if (error instanceof NetworkError) {
    return 4;
  }

  // 1 — local input validation / config errors.
  if (error instanceof ValidationError) {
    return 1;
  }
  if (error instanceof IdempotencyKeyRequiredError) {
    return 1;
  }
  if (error instanceof ConfigError) {
    return 1;
  }

  // ApiBusinessError — subdivide by HTTP status.
  if (error instanceof ApiBusinessError) {
    const status = error.statusCode;
    // auth-fail / invalid-key / scope denied
    if (status === 401 || status === 403) {
      return 3;
    }
    // backend 5xx
    if (status >= 500) {
      return 4;
    }
    // 404 / 409 / 429 / other 4xx → business / param
    return 1;
  }

  // unknown / unexpected → business bucket
  return 1;
}
