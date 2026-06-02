import { describe, it, expect } from 'vitest';
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
 * §4.4 errorCodeFor / toErrorEnvelope — 错误目录
 *
 * **Property 4: error code is always a known SCREAMING_SNAKE enum**
 * **Validates: Requirements 5.2**
 */
describe('errorCodeFor', () => {
  it('UT-ERR-01: UpgradeRequiredError -> UPGRADE_REQUIRED', () => {
    expect(errorCodeFor(new UpgradeRequiredError('a', 'b', 'c'))).toBe('UPGRADE_REQUIRED');
  });

  it('UT-ERR-02: AuthError (not signed in) -> AUTH_NOT_SIGNED_IN', () => {
    expect(errorCodeFor(new AuthError('Not signed in', 'run login'))).toBe('AUTH_NOT_SIGNED_IN');
  });

  it('UT-ERR-03: AuthError (session expired) -> AUTH_SESSION_EXPIRED', () => {
    expect(errorCodeFor(new AuthError('Session expired, please refresh', 's'))).toBe(
      'AUTH_SESSION_EXPIRED',
    );
  });

  it('UT-ERR-04: AuthError (timeout) -> AUTH_TIMEOUT', () => {
    expect(errorCodeFor(new AuthError('Magic link timed out', 's'))).toBe('AUTH_TIMEOUT');
  });

  it('UT-ERR-05: ApiBusinessError 401 -> AUTH_FAILED', () => {
    expect(errorCodeFor(new ApiBusinessError(1002, 'm', 401))).toBe('AUTH_FAILED');
  });

  it('UT-ERR-06: ApiBusinessError 403 -> KEY_SCOPE_DENIED', () => {
    expect(errorCodeFor(new ApiBusinessError(1102, 'm', 403))).toBe('KEY_SCOPE_DENIED');
  });

  it('UT-ERR-07: ApiBusinessError 404 -> ORG_NOT_FOUND (默认 noun)', () => {
    expect(errorCodeFor(new ApiBusinessError(1201, 'm', 404))).toBe('ORG_NOT_FOUND');
  });

  it('UT-ERR-09: ApiBusinessError 409 -> ORG_CONFLICT', () => {
    expect(errorCodeFor(new ApiBusinessError(1004, 'm', 409))).toBe('ORG_CONFLICT');
  });

  it('UT-ERR-10: ApiBusinessError 429 -> RATE_LIMITED', () => {
    expect(errorCodeFor(new ApiBusinessError(1429, 'm', 429))).toBe('RATE_LIMITED');
  });

  it('UT-ERR-11: ApiBusinessError 其它 4xx -> PARAM_INVALID', () => {
    expect(errorCodeFor(new ApiBusinessError(2101, 'm', 422))).toBe('PARAM_INVALID');
  });

  it('UT-ERR-12: ApiBusinessError 5xx -> UPSTREAM_UNAVAILABLE', () => {
    expect(errorCodeFor(new ApiBusinessError(5000, 'm', 503))).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('UT-ERR-13: ValidationError -> PARAM_INVALID', () => {
    expect(errorCodeFor(new ValidationError('m'))).toBe('PARAM_INVALID');
  });

  it('UT-ERR-14: ConfigError -> INTERNAL_ERROR', () => {
    expect(errorCodeFor(new ConfigError('m', 'p'))).toBe('INTERNAL_ERROR');
  });

  it('UT-ERR-15: NetworkError -> UPSTREAM_UNAVAILABLE', () => {
    expect(errorCodeFor(new NetworkError('u'))).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('UT-ERR-16: UserCancelError -> USER_CANCELLED', () => {
    expect(errorCodeFor(new UserCancelError())).toBe('USER_CANCELLED');
  });

  it('UT-ERR-17: 未知 throwable -> INTERNAL_ERROR', () => {
    expect(errorCodeFor(new Error('x'))).toBe('INTERNAL_ERROR');
    expect(errorCodeFor('string')).toBe('INTERNAL_ERROR');
    expect(errorCodeFor(null)).toBe('INTERNAL_ERROR');
  });

  it('UT-ERR-18: 任意输入返回值恒 ∈ ErrorCode union', () => {
    const samples: unknown[] = [
      new UpgradeRequiredError('a', 'b', 'c'),
      new AuthError('m', 's'),
      new ApiBusinessError(1, 'm', 401),
      new NetworkError('u'),
      new ValidationError('m'),
      new ConfigError('m', 'p'),
      new UserCancelError(),
      new Error('x'),
      'str',
      null,
      undefined,
      {},
    ];
    for (const s of samples) {
      expect(ALL_CODES).toContain(errorCodeFor(s));
    }
  });
});

describe('toErrorEnvelope', () => {
  it('UT-ERR-19: 结构 { error: { code, message, http? } }', () => {
    const env = toErrorEnvelope(new ApiBusinessError(1201, 'not found', 404));
    expect(env.error.code).toBe('ORG_NOT_FOUND');
    expect(env.error.message).toBeTruthy();
    expect(env.error.http).toBe(404);
  });

  it('非 HTTP 来源 (NetworkError) 不含 http 字段', () => {
    const env = toErrorEnvelope(new NetworkError('https://x', 30000));
    expect(env.error.http).toBeUndefined();
    expect(env.error.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('本地错误 (ValidationError) 不含 http 字段', () => {
    const env = toErrorEnvelope(new ValidationError('bad'));
    expect(env.error.http).toBeUndefined();
  });

  it('code 恒非空、message 恒非空（含非 Error 输入）', () => {
    for (const s of [new Error(''), 'str', null, undefined, 42, {}]) {
      const env = toErrorEnvelope(s);
      expect(env.error.code).toBeTruthy();
      expect(env.error.message).toBeTruthy();
    }
  });
});
