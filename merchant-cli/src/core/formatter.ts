export type StatusType = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<StatusType, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export class Formatter {
  /** Status-prefixed line, e.g. "✓ done". */
  static status(type: StatusType, message: string): string {
    return `${ICONS[type]} ${message}`;
  }

  /** Aligned columnar table for list output. */
  static table(headers: string[], rows: string[][]): string {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
    );
    const line = (cells: string[]): string =>
      cells.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ');
    return [
      line(headers),
      widths.map((w) => '-'.repeat(w)).join('  '),
      ...rows.map(line),
    ].join('\n');
  }

  /** Key-value detail output with left-aligned keys. */
  static keyValue(entries: [string, string][]): string {
    const width = Math.max(0, ...entries.map(([k]) => k.length));
    return entries.map(([k, v]) => `${k.padEnd(width)}  ${v}`).join('\n');
  }

  /** Best-effort human-readable rendering of arbitrary data. */
  static auto(data: unknown): string {
    if (Array.isArray(data)) {
      const rows = data as Record<string, unknown>[];
      if (rows.length === 0) return '(empty)';
      const headers = Object.keys(rows[0] ?? {});
      return Formatter.table(
        headers,
        rows.map((r) => headers.map((h) => stringify(r[h]))),
      );
    }
    if (data && typeof data === 'object') {
      const entries = Object.entries(data as Record<string, unknown>).map(
        ([k, v]) => [k, stringify(v)] as [string, string],
      );
      return Formatter.keyValue(entries);
    }
    return stringify(data);
  }
}
