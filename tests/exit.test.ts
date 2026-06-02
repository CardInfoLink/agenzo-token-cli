import { describe, it, expect } from 'vitest';
import { exitCodeFor } from '../src/utils/exit';
import {
  ApiBusinessError,
  AuthError,
  ConfigError,
  NetworkError,
  UpgradeRequiredError,
  UserCancelError,
  ValidationError,
} from '../src/utils/errors';

/**
 * §4.3 exitCodeFor — 退出码映射
 *
 * **Property 3: every failure maps to exactly one exit code in 1-5**
 * **Validates: Requirements 5.1**
 *
 * 每个用例对应 design「错误类→退出码矩阵」一行。
 * 1 业务/参数(4xx) · 2 需升级 · 3 认证失败/无效key · 4 网络/5xx · 5 用户取消
 */
describe('exitCodeFor', () => {
  it('UT-EXIT-01: UpgradeRequiredError -> 2', () => {
    expect(exitCodeFor(new UpgradeRequiredError('0.1.0', '0.2.0', 'npm i -g x'))).toBe(2);
  });

  it('UT-EXIT-02: AuthError (not signed in) -> 3', () => {
    expect(exitCodeFor(new AuthError('Not signed in', 'run login'))).toBe(3);
  });

  it('UT-EXIT-03: AuthError (session expired) -> 3', () => {
    expect(exitCodeFor(new AuthError('Session expired', 'run login'))).toBe(3);
  });

  it('UT-EXIT-04: AuthError (magic-link timeout) -> 3', () => {
    expect(exitCodeFor(new AuthError('Magic link timed out', 'retry'))).toBe(3);
  });

  it('UT-EXIT-05: ApiBusinessError 401 -> 3', () => {
    expect(exitCodeFor(new ApiBusinessError(1002, 'unauthorized', 401))).toBe(3);
  });

  it('UT-EXIT-06: ApiBusinessError 403 -> 3', () => {
    expect(exitCodeFor(new ApiBusinessError(1102, 'scope denied', 403))).toBe(3);
  });

  it('UT-EXIT-07: ApiBusinessError 404 -> 1', () => {
    expect(exitCodeFor(new ApiBusinessError(1201, 'not found', 404))).toBe(1);
  });

  it('UT-EXIT-08: ApiBusinessError 409 -> 1', () => {
    expect(exitCodeFor(new ApiBusinessError(1004, 'conflict', 409))).toBe(1);
  });

  it('UT-EXIT-09: ApiBusinessError 429 -> 1', () => {
    expect(exitCodeFor(new ApiBusinessError(1429, 'rate limited', 429))).toBe(1);
  });

  it('UT-EXIT-10: ApiBusinessError 422 (other 4xx) -> 1', () => {
    expect(exitCodeFor(new ApiBusinessError(2101, 'invalid', 422))).toBe(1);
  });

  it('UT-EXIT-11: ApiBusinessError 500 (5xx) -> 4', () => {
    expect(exitCodeFor(new ApiBusinessError(5000, 'server error', 500))).toBe(4);
  });

  it('UT-EXIT-12: ValidationError -> 1', () => {
    expect(exitCodeFor(new ValidationError('bad input'))).toBe(1);
  });

  it('UT-EXIT-13: ConfigError -> 1', () => {
    expect(exitCodeFor(new ConfigError('corrupt', '/path/config.json'))).toBe(1);
  });

  it('UT-EXIT-14: NetworkError -> 4', () => {
    expect(exitCodeFor(new NetworkError('https://x', 30000))).toBe(4);
  });

  it('UT-EXIT-15: UserCancelError (SIGINT) -> 5', () => {
    expect(exitCodeFor(new UserCancelError())).toBe(5);
  });

  it('UT-EXIT-16: 未知 Error -> 1', () => {
    expect(exitCodeFor(new Error('boom'))).toBe(1);
  });

  it('UT-EXIT-17: 非 Error 输入 (string/null/undefined) -> 1', () => {
    expect(exitCodeFor('string error')).toBe(1);
    expect(exitCodeFor(null)).toBe(1);
    expect(exitCodeFor(undefined)).toBe(1);
  });

  it('UT-EXIT-18: 返回值恒 ∈ {1,2,3,4,5}', () => {
    const samples: unknown[] = [
      new UpgradeRequiredError('a', 'b', 'c'),
      new AuthError('m', 's'),
      new ApiBusinessError(1, 'm', 401),
      new ApiBusinessError(1, 'm', 404),
      new ApiBusinessError(1, 'm', 500),
      new NetworkError('u'),
      new ValidationError('m'),
      new ConfigError('m', 'p'),
      new UserCancelError(),
      new Error('x'),
      'str',
      null,
      undefined,
      42,
      {},
    ];
    for (const s of samples) {
      expect([1, 2, 3, 4, 5]).toContain(exitCodeFor(s));
    }
  });
});
