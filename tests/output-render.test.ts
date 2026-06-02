import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '../src/utils/output';
import type { CommandResult } from '../src/types/commands';

/**
 * §4.2 render — 中央渲染器
 *
 * **Property 1: stdout is valid, payload-only JSON in json mode**
 * **Property 5: secrets never appear on stdout**
 * **Validates: Requirements 4.1, 6.1**
 *
 * 捕获 stdout：spy 掉 process.stdout.write，断言写入内容。
 */
function captureStdout(): { spy: ReturnType<typeof vi.spyOn>; output: () => string } {
  const chunks: string[] = [];
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
  return { spy, output: () => chunks.join('') };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('render', () => {
  it('UT-RND-01: json 模式 stdout 经 JSON.parse 往返后 deep-equal data', () => {
    const data = { a: 1, b: 'x', nested: { c: [1, 2, 3] } };
    const result: CommandResult<typeof data> = {
      data,
      text: () => 'HUMAN TEXT SHOULD NOT APPEAR',
    };
    const { output } = captureStdout();
    render(result, { format: 'json' });
    expect(JSON.parse(output())).toEqual(data);
  });

  it('UT-RND-02: json 模式 stdout 不含人读文本', () => {
    const result: CommandResult<{ ok: boolean }> = {
      data: { ok: true },
      text: () => '✓ Signed in\n  Org ID  org_123',
    };
    const { output } = captureStdout();
    render(result, { format: 'json' });
    expect(output()).not.toContain('✓');
    expect(output()).not.toContain('Org ID');
  });

  it('UT-RND-03: table 模式 stdout === result.text()', () => {
    const text = '✓ Done\n  Key  value';
    const result: CommandResult<{ ignored: boolean }> = {
      data: { ignored: true },
      text: () => text,
    };
    const { output } = captureStdout();
    render(result, { format: 'table' });
    // render 追加一个换行
    expect(output()).toBe(`${text}\n`);
  });

  it('UT-RND-04: keys create 的 api_key 出现在 json，但 Bearer token 不出现', () => {
    const data = {
      id: 'key_123',
      api_key: 'agz_live_sk_8c4f2a1e9d7b6c5e',
      name: 'Production Key',
      status: 'active',
    };
    const result: CommandResult<typeof data> = {
      data,
      text: () => 'shown only once',
    };
    const { output } = captureStdout();
    render(result, { format: 'json' });
    const out = output();
    expect(out).toContain('api_key');
    expect(out).not.toContain('access_token');
    expect(out).not.toContain('refresh_token');
  });

  it('UT-RND-06: note 不进 stdout', () => {
    const result: CommandResult<{ signed_out: boolean }> = {
      data: { signed_out: true },
      text: () => 'bye',
      note: 'Signed out',
    };
    const { output } = captureStdout();
    render(result, { format: 'json' });
    expect(output()).not.toContain('Signed out');
  });

  it('UT-RND-07: data 为数组时 stdout 是合法 JSON 数组', () => {
    const data = [
      { org_id: 'org_1', active: true },
      { org_id: 'org_2', active: false },
    ];
    const result: CommandResult<typeof data> = {
      data,
      text: () => 'table view',
    };
    const { output } = captureStdout();
    render(result, { format: 'json' });
    const parsed = JSON.parse(output());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual(data);
  });

  it('json 输出以换行结尾，便于管道 jq', () => {
    const result: CommandResult<{ a: number }> = { data: { a: 1 }, text: () => '' };
    const { output } = captureStdout();
    render(result, { format: 'json' });
    expect(output().endsWith('\n')).toBe(true);
  });
});
