export type StatusPrefix = 'success' | 'error' | 'info' | 'warning' | 'loading';

const STATUS_ICONS: Record<StatusPrefix, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
  loading: '⠋',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface Spinner {
  /** Update the spinner message while it's running */
  update(message: string): void;
  /** Stop the spinner and show a final status line */
  stop(type?: StatusPrefix, finalMessage?: string): void;
}

/**
 * Creates an animated terminal spinner that cycles through braille frames.
 * Call `spinner.stop()` when the async work is done.
 */
export function createSpinner(message: string, intervalMs = 60): Spinner {
  let frameIdx = 0;
  let currentMessage = message;

  const render = () => {
    process.stdout.write(`\r\x1b[K${SPINNER_FRAMES[frameIdx]} ${currentMessage}`);
    frameIdx = (frameIdx + 1) % SPINNER_FRAMES.length;
  };

  render();
  const timer = setInterval(render, intervalMs);

  return {
    update(msg: string) {
      currentMessage = msg;
    },
    stop(type?: StatusPrefix, finalMessage?: string) {
      clearInterval(timer);
      process.stdout.write('\r\x1b[K');
      if (type && finalMessage) {
        console.log(Formatter.status(type, finalMessage));
      }
    },
  };
}

export class Formatter {
  /** Get display width of a string (CJK characters count as 2) */
  private static displayWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      const code = char.codePointAt(0)!;
      // CJK Unified Ideographs and common fullwidth ranges
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified
        (code >= 0x3000 && code <= 0x303f) ||  // CJK Punctuation
        (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
        (code >= 0xff00 && code <= 0xffef) ||  // Fullwidth Forms
        (code >= 0xf900 && code <= 0xfaff) ||  // CJK Compatibility
        (code >= 0x20000 && code <= 0x2a6df)   // CJK Extension B
      ) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  /** Pad string to target display width (right-pad with spaces) */
  private static padEndDisplay(str: string, targetWidth: number): string {
    const currentWidth = Formatter.displayWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + ' '.repeat(padding);
  }

  /** Pad string to target display width (left-pad with spaces) */
  private static padStartDisplay(str: string, targetWidth: number): string {
    const currentWidth = Formatter.displayWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return ' '.repeat(padding) + str;
  }

  /** Table output for list commands — columns aligned by max width */
  static table(headers: string[], rows: string[][]): string {
    const colWidths = headers.map((h, i) => {
      const cellWidths = rows.map((r) => Formatter.displayWidth(r[i] ?? ''));
      return Math.max(Formatter.displayWidth(h), ...cellWidths);
    });

    const sep = '  ';

    const headerLine = headers.map((h, i) => Formatter.padEndDisplay(h, colWidths[i])).join(sep);
    const divider = colWidths.map((w) => '-'.repeat(w)).join(sep);
    const dataLines = rows.map((row) =>
      row.map((cell, i) => Formatter.padEndDisplay(cell ?? '', colWidths[i])).join(sep),
    );

    return [headerLine, divider, ...dataLines].join('\n');
  }

  /** Key-value output for detail commands — keys left-aligned */
  static keyValue(entries: [string, string][]): string {
    const maxKeyWidth = Math.max(...entries.map(([k]) => Formatter.displayWidth(k)));
    return entries
      .map(([key, value]) => `${Formatter.padEndDisplay(key, maxKeyWidth)}  ${value}`)
      .join('\n');
  }

  /** Status-prefixed message */
  static status(type: StatusPrefix, message: string): string {
    return `${STATUS_ICONS[type]} ${message}`;
  }

  /** Mask sensitive info, keeping only the prefix */
  static maskKey(key: string, prefixLength = 8): string {
    if (key.length <= prefixLength) {
      return key;
    }
    return key.slice(0, prefixLength) + '*'.repeat(key.length - prefixLength);
  }
}
