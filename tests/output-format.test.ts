import { describe, it, expect } from 'vitest';
import { resolveFormat, type OutputFormat } from '../src/utils/output';

/**
 * §4.1 resolveFormat — 输出格式解析
 *
 * **Property 2: format resolution precedence**
 * **Validates: Requirements 4.2**
 *
 * 精度：`--format` flag > `AGENZO_FORMAT` env > 默认 `table`。
 * 注意（与真实实现对齐）：flag 一旦提供即“权威”——provided-but-invalid 的 flag
 * 直接回退默认 `table`，不再下沉到 env。
 */
describe('resolveFormat', () => {
  it('UT-FMT-01: flag 优先于 env (json over table)', () => {
    expect(resolveFormat('json', 'table')).toBe('json');
  });

  it('UT-FMT-02: flag 优先于 env (table over json)', () => {
    expect(resolveFormat('table', 'json')).toBe('table');
  });

  it('UT-FMT-03: 无 flag 时取 env (json)', () => {
    expect(resolveFormat(undefined, 'json')).toBe('json');
  });

  it('UT-FMT-04: 无 flag 无 env 回退默认 table', () => {
    expect(resolveFormat(undefined, undefined)).toBe('table');
  });

  it('UT-FMT-05: 非法 flag 回退默认 table（flag 权威，不下沉 env）', () => {
    expect(resolveFormat('xml')).toBe('table');
    // 即便 env 合法，非法 flag 仍回退默认，不取 env
    expect(resolveFormat('xml', 'json')).toBe('table');
  });

  it('UT-FMT-06: 非法 env + 无 flag 回退默认 table', () => {
    expect(resolveFormat(undefined, 'yaml')).toBe('table');
  });

  it('UT-FMT-07: 大小写敏感，JSON 视为非法 → table', () => {
    expect(resolveFormat('JSON')).toBe('table');
    expect(resolveFormat('Table')).toBe('table');
  });

  it('UT-FMT-08: 返回值恒 ∈ {json, table}', () => {
    const inputs: Array<[string | undefined, string | undefined]> = [
      ['json', undefined],
      ['table', undefined],
      ['xml', 'json'],
      [undefined, 'yaml'],
      [undefined, undefined],
      ['', ''],
    ];
    const allowed: OutputFormat[] = ['json', 'table'];
    for (const [flag, env] of inputs) {
      expect(allowed).toContain(resolveFormat(flag, env));
    }
  });

  it('空字符串 flag 视为非法 → table', () => {
    expect(resolveFormat('')).toBe('table');
  });
});
