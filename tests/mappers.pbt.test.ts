import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { exitCodeFor } from '../src/utils/exit';
import {
  errorCodeFor,
  toErrorEnvelope,
  ApiBusinessError,
  AuthError,
  ConfigError,
  NetworkError,
  UpgradeRequiredError,
  UserCancelError,
  ValidationError,
  type ErrorCode,
} from '../src/utils/errors';

/**
 * Property-based tests for the exit / error mappers (fast-check).
 *
 * **Property 3: every failure maps to exactly one exit code in 1-5**
 * **Property 4: error code is always a known SCREAMING_SNAKE enum**
 * **Validates: Requirements 5.1, 5.2**
 *
 * These fuzz arbitrary throwables — every known `CliError` subclass (with
 * randomised `statusCode` for `ApiBusinessError`) plus arbitrary non-`CliError`
 * values (strings, numbers, plain objects, null/undefined, ...) — and assert
 * the universal invariants of the two pure mappers hold across all inputs.
 */

/**
 * The complete, hardcoded set of legal `ErrorCode` union members. Hardcoded
 * (rather than derived) so the test fails loudly if the union drifts away from
 * what the spec's error catalog promises.
 */
const ALL_CODES: ErrorCode[] = [
  'AUTH_FAILED',
  'AUTH_INVALID_API_KEY',
  'AUTH_NOT_SIGNED_IN',
  'AUTH_SESSION_EXPIRED',
  'AUTH_TIMEOUT',
  'ORG_NOT_FOUND',
  'ORG_CONFLICT',
  'KEY_NOT_FOUND',
  'KEY_SCOPE_DENIED',
  'PARAM_INVALID',
  'PARAM_MISSING',
  'PARAM_IDEMPOTENCY_KEY_REQUIRED',
  'PARAM_IDEMPOTENCY_KEY_CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'UPGRADE_REQUIRED',
  'USER_CANCELLED',
  'INTERNAL_ERROR',
];

/**
 * Generator for every known `CliError` subclass. `ApiBusinessError` is built
 * from a random HTTP-ish `statusCode` (1xx–5xx and beyond) plus random
 * backend `errorCode` / message so the status-keyed branches are all exercised.
 */
const arbCliError: fc.Arbitrary<unknown> = fc.oneof(
  fc
    .record({
      errorCode: fc.integer({ min: 0, max: 9999 }),
      message: fc.string(),
      statusCode: fc.integer({ min: 100, max: 599 }),
    })
    .map((r) => new ApiBusinessError(r.errorCode, r.message, r.statusCode)),
  fc
    .record({ message: fc.string(), suggestion: fc.string() })
    .map((r) => new AuthError(r.message, r.suggestion)),
  fc.string().map((u) => new NetworkError(u)),
  fc.string().map((m) => new ValidationError(m)),
  fc
    .record({ message: fc.string(), path: fc.string() })
    .map((r) => new ConfigError(r.message, r.path)),
  fc
    .record({ cur: fc.string(), min: fc.string(), cmd: fc.string() })
    .map((r) => new UpgradeRequiredError(r.cur, r.min, r.cmd)),
  fc.string().map((m) => new UserCancelError(m)),
);

/**
 * Generator for arbitrary non-`CliError` throwables: plain `Error`s, raw
 * strings, numbers, plain objects, arrays, null, undefined, booleans, etc.
 */
const arbNonCliError: fc.Arbitrary<unknown> = fc.oneof(
  fc.string().map((m) => new Error(m)),
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.object(),
  fc.array(fc.anything()),
  fc.anything(),
);

/** Any throwable value the top-level handler might receive. */
const arbError: fc.Arbitrary<unknown> = fc.oneof(arbCliError, arbNonCliError);

describe('mappers property-based', () => {
  /**
   * **Property 3: every failure maps to exactly one exit code in 1-5**
   * **Validates: Requirements 5.1**
   */
  it('PBT-01: exitCodeFor always returns a value in {1,2,3,4,5}', () => {
    fc.assert(
      fc.property(arbError, (e) => {
        expect([1, 2, 3, 4, 5]).toContain(exitCodeFor(e));
      }),
    );
  });

  /**
   * **Property 4: error code is always a known SCREAMING_SNAKE enum**
   * **Validates: Requirements 5.2**
   */
  it('PBT-02: errorCodeFor always returns a member of the ErrorCode union', () => {
    fc.assert(
      fc.property(arbError, (e) => {
        expect(ALL_CODES).toContain(errorCodeFor(e));
      }),
    );
  });

  /**
   * **Property 4: error code is always a known SCREAMING_SNAKE enum**
   * (envelope clause: code + message are always non-empty)
   * **Validates: Requirements 5.2**
   */
  it('PBT-03: toErrorEnvelope yields non-empty code and message', () => {
    fc.assert(
      fc.property(arbError, (e) => {
        const env = toErrorEnvelope(e);
        expect(ALL_CODES).toContain(env.error.code);
        expect(env.error.message.length).toBeGreaterThan(0);
      }),
    );
  });
});
