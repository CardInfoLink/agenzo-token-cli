import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerLoginCommand } from '../src/auth/login';
import { registerRotateCommand } from '../src/keys/rotate';
import { registerDisableCommand } from '../src/keys/disable';
import { IdempotencyKeyRequiredError } from '../src/utils/errors';

/**
 * §4.6 服务端写命令的 --idempotency-key 策略（Property 6 / Req 4.3, cli-design §1）
 *
 * 策略：所有服务端写命令的 --idempotency-key 都是必需的，但缺失时的处理分两种模式：
 *  - 交互模式（默认）：缺失时弹 prompt 让用户补输（不在此测试里走真实 prompt，会挂起）。
 *  - 非交互模式（--yes，自动化/AI Agent）：prompt 会挂起，所以缺失时抛
 *    IdempotencyKeyRequiredError，且在任何网络调用之前抛出。
 *
 * CLI 永不自动生成 key。这三条与 orgs update / developers create/update /
 * keys create 行为一致，共同满足"所有服务端写必须幂等"。
 */

/** Build a root program (with the global --yes flag) and register one command. */
function programWith(register: (root: Command) => void): Command {
  const root = new Command();
  root.exitOverride(); // throw instead of process.exit on parse errors
  // The real top-level program defines --yes globally; mirror it here so
  // optsWithGlobals().yes is observable by the handlers under test.
  root.option('--yes', 'Skip confirmation prompts (for automation/AI Agents)');
  register(root);
  return root;
}

describe('mandatory --idempotency-key on server-write commands (--yes mode)', () => {
  it('auth login --yes 缺 --idempotency-key → IdempotencyKeyRequiredError（不触达 authService）', async () => {
    let loginCalled = false;
    const authService = {
      login: async () => {
        loginCalled = true;
        return {} as never;
      },
    };
    const root = programWith((r) =>
      registerLoginCommand(r, { authService: authService as never }),
    );

    await expect(
      root.parseAsync(['node', 'cli', '--yes', 'login', '--email', 'a@b.com']),
    ).rejects.toBeInstanceOf(IdempotencyKeyRequiredError);
    expect(loginCalled).toBe(false);
  });

  it('keys rotate --yes 缺 --idempotency-key → IdempotencyKeyRequiredError（不触达 apiClient）', async () => {
    let postCalled = false;
    const deps = {
      apiClient: {},
      authService: {
        executeWithAuth: async () => {
          postCalled = true;
          return {} as never;
        },
      },
      keyStore: {},
      configManager: {},
    };
    const root = programWith((r) => registerRotateCommand(r, deps as never));

    await expect(
      root.parseAsync(['node', 'cli', '--yes', 'rotate', 'key_x']),
    ).rejects.toBeInstanceOf(IdempotencyKeyRequiredError);
    expect(postCalled).toBe(false);
  });

  it('keys disable --yes 缺 --idempotency-key → IdempotencyKeyRequiredError（不触达 apiClient）', async () => {
    let postCalled = false;
    const deps = {
      apiClient: {},
      authService: {
        executeWithAuth: async () => {
          postCalled = true;
          return {} as never;
        },
      },
    };
    const root = programWith((r) => registerDisableCommand(r, deps as never));

    await expect(
      root.parseAsync(['node', 'cli', '--yes', 'disable', 'key_x']),
    ).rejects.toBeInstanceOf(IdempotencyKeyRequiredError);
    expect(postCalled).toBe(false);
  });

  it('IdempotencyKeyRequiredError 的消息含命令名与 --idempotency-key 提示', () => {
    const e = new IdempotencyKeyRequiredError('keys rotate');
    expect(e.message).toContain('keys rotate');
    expect(e.message).toContain('--idempotency-key');
  });
});
