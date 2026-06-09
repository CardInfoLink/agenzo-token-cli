export type StatusType = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<StatusType, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface Spinner {
  /** Update the in-progress message. */
  update(message: string): void;
  /** Stop and clear the spinner line (no final status). */
  stop(): void;
  /** Stop and replace the line with a success status. */
  succeed(message?: string): void;
  /** Stop and replace the line with an error status. */
  fail(message?: string): void;
}

/**
 * TTY-aware progress spinner. Renders to **stderr** so that stdout stays a
 * clean payload stream (agents/scripts piping `| jq` are unaffected).
 *
 * When stderr is not a TTY (piped, redirected, CI, agent-invoked) the animation
 * is suppressed entirely — no control characters leak into logs. The optional
 * final status (`succeed`/`fail`) is still printed in that case so non-TTY
 * callers get a one-line outcome on stderr without the spinning frames.
 */
export function createSpinner(message: string): Spinner {
  const isTty = Boolean(process.stderr.isTTY);
  let current = message;

  if (!isTty) {
    return {
      update(msg: string) {
        current = msg;
      },
      stop() {},
      succeed(msg?: string) {
        if (msg) process.stderr.write(`${Formatter.status('success', msg)}\n`);
      },
      fail(msg?: string) {
        process.stderr.write(`${Formatter.status('error', msg ?? current)}\n`);
      },
    };
  }

  let frame = 0;
  const render = (): void => {
    process.stderr.write(`\r\x1b[K${SPINNER_FRAMES[frame]} ${current}`);
    frame = (frame + 1) % SPINNER_FRAMES.length;
  };
  render();
  const timer = setInterval(render, 80);

  const clear = (): void => {
    clearInterval(timer);
    process.stderr.write('\r\x1b[K');
  };

  return {
    update(msg: string) {
      current = msg;
    },
    stop() {
      clear();
    },
    succeed(msg?: string) {
      clear();
      if (msg) process.stderr.write(`${Formatter.status('success', msg)}\n`);
    },
    fail(msg?: string) {
      clear();
      process.stderr.write(`${Formatter.status('error', msg ?? current)}\n`);
    },
  };
}

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
      return Formatter.arrayTable(data);
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const scalarEntries: [string, string][] = [];
      const tableSections: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        // Render an array-of-objects value as its own labelled sub-table
        // instead of dumping raw JSON on a key-value line.
        if (Array.isArray(v) && v.some((i) => i && typeof i === 'object')) {
          tableSections.push(`${k}:\n${Formatter.arrayTable(v)}`);
        } else {
          scalarEntries.push([k, stringify(v)]);
        }
      }
      const parts: string[] = [];
      if (scalarEntries.length) parts.push(Formatter.keyValue(scalarEntries));
      parts.push(...tableSections);
      return parts.join('\n\n');
    }
    return stringify(data);
  }

  /** Render an array of objects as an aligned table; falls back gracefully. */
  private static arrayTable(items: unknown[]): string {
    if (items.length === 0) return '(empty)';
    const rows = items.filter(
      (i): i is Record<string, unknown> => Boolean(i) && typeof i === 'object',
    );
    if (rows.length === 0) {
      return items.map((i) => stringify(i)).join(', ');
    }
    const headers = Object.keys(rows[0]);
    return Formatter.table(
      headers,
      rows.map((r) => headers.map((h) => stringify(r[h]))),
    );
  }
}
