import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerConfigCommand } from '../src/config/set';

/**
 * 回归测试：config set-host / reset-host 不得重复打印（GAPA-049）
 *
 * 历史 bug：applyHost 同时用 notify()(stderr) + CommandResult.text()(stdout) 输出
 * 同样的状态行，table 模式下每行打两遍（一次 stderr、一次 stdout）。
 *
 * 契约（cli-standard §5.1/§5.2）：
 * - 状态行（✓ / ℹ）只走 stderr（notify）
 * - stdout 只承载 payload 投影（API Host / Active Org），不含任何状态图标
 */

const STATUS_ICONS = ['✓', 'ℹ', '⚠', '✗'];

/** 捕获 stdout(process.stdout.write) 与 stderr(console.error)，分别返回拼接文本。 */
function capture() {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => {
    out.push(typeof c === 'string' ? c : Buffer.from(c).toString());
    return true;
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    err.push(args.map(String).join(' '));
  });
  return { stdout: () => out.join(''), stderr: () => err.join('\n') };
}

/** 构造一个挂了 config 命令组的根程序，注入 stub deps。 */
function programWith(deps: {
  configManager: unknown;
  credentialStore: unknown;
}): Command {
  const root = new Command();
  root.exitOverride();
  registerConfigCommand(root, deps as never);
  return root;
}

/** 最小 stub：set-host 走"无匹配凭证→清空 active_org"分支（不依赖真实文件）。 */
function makeDeps(opts: { match?: { org_id: string; org_name: string; api_host: string } } = {}) {
  const saved: Record<string, unknown> = { active_org: 'old', api_host: 'old', api_path: '/p' };
  const configManager = {
    setApiHost: vi.fn(async (h: string) => {
      saved.api_host = h;
    }),
    setActiveOrg: vi.fn(async (id: string) => {
      saved.active_org = id;
    }),
    load: vi.fn(async () => ({ ...saved })),
    save: vi.fn(async (c: Record<string, unknown>) => {
      Object.assign(saved, c);
    }),
  };
  const credentialStore = {
    listAll: vi.fn(async () => (opts.match ? [opts.match] : [])),
  };
  return { configManager, credentialStore };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('config set-host / reset-host 输出不重复（GAPA-049 回归）', () => {
  it('TC-CFG-SET-DEDUP-01: 无匹配凭证时，stdout 仅 payload、不含状态图标', async () => {
    const deps = makeDeps();
    const cap = capture();
    const root = programWith(deps);

    await root.parseAsync(['node', 'cli', 'config', 'set-host', 'http://localhost:8000']);

    const stdout = cap.stdout();
    // stdout 是 payload 投影
    expect(stdout).toContain('API Host');
    expect(stdout).toContain('Active Org');
    // stdout 不含任何状态图标（✓/ℹ 等只应在 stderr）
    for (const icon of STATUS_ICONS) {
      expect(stdout).not.toContain(icon);
    }
    // stdout 不含状态行文案
    expect(stdout).not.toContain('API host set to');
    expect(stdout).not.toContain('Please run login');
  });

  it('TC-CFG-SET-DEDUP-02: 状态行只在 stderr 出现一次（不重复）', async () => {
    const deps = makeDeps();
    const cap = capture();
    const root = programWith(deps);

    await root.parseAsync(['node', 'cli', 'config', 'set-host', 'http://localhost:8000']);

    const stderr = cap.stderr();
    // "API host set to" 状态行恰好出现一次
    const occurrences = stderr.split('API host set to').length - 1;
    expect(occurrences).toBe(1);
  });

  it('TC-CFG-SET-DEDUP-03: 命中凭证时 stdout 含 active_org、不含 Switched 状态行', async () => {
    const deps = makeDeps({
      match: { org_id: 'org_x', org_name: 'Acme', api_host: 'http://localhost:8000' },
    });
    const cap = capture();
    const root = programWith(deps);

    await root.parseAsync(['node', 'cli', 'config', 'set-host', 'http://localhost:8000']);

    const stdout = cap.stdout();
    expect(stdout).toContain('org_x'); // active_org payload
    expect(stdout).not.toContain('Switched to organization'); // 状态行只在 stderr
    // stderr 才有 Switched 行，且只一次
    const stderr = cap.stderr();
    expect(stderr.split('Switched to organization').length - 1).toBe(1);
  });

  it('TC-CFG-SET-DEDUP-04: json 模式 stdout 是合法 JSON、stderr 静默（notify json 不输出）', async () => {
    const deps = makeDeps();
    const cap = capture();
    const root = programWith(deps);
    // `--format` 是真实 index.ts 上的全局选项；测试不挂全局 wiring，
    // 改用 AGENZO_FORMAT 驱动 json（resolveFormat 默认读该 env）。
    const prev = process.env.AGENZO_FORMAT;
    process.env.AGENZO_FORMAT = 'json';
    try {
      await root.parseAsync(['node', 'cli', 'config', 'set-host', 'http://localhost:8000']);
    } finally {
      if (prev === undefined) delete process.env.AGENZO_FORMAT;
      else process.env.AGENZO_FORMAT = prev;
    }

    const parsed = JSON.parse(cap.stdout());
    expect(parsed).toMatchObject({ api_host: 'http://localhost:8000', active_org: null });
    // json 模式 notify 静默，无状态行
    expect(cap.stderr()).not.toContain('API host set to');
  });

  it('TC-CFG-RST-DEDUP-05: reset-host 同样不重复（共用 applyHost）', async () => {
    const deps = makeDeps();
    const cap = capture();
    const root = programWith(deps);

    await root.parseAsync(['node', 'cli', 'config', 'reset-host']);

    const stdout = cap.stdout();
    for (const icon of STATUS_ICONS) {
      expect(stdout).not.toContain(icon);
    }
    expect(stdout).toContain('API Host');
    expect(cap.stderr().split('API host reset to').length - 1).toBe(1);
  });
});
