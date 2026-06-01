/**
 * CLI version source-of-truth + server-driven min-version negotiation.
 *
 * The running version is read from `package.json` at runtime (it lives outside
 * `rootDir`, so we read it via fs rather than importing it to keep `tsc` happy).
 * The server advertises the floor via the `X-CLI-Min-Version` response header;
 * if the local version is below it we throw CLI_OUTDATED and exit with code 2.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError, ErrorCodes } from './errors.js';

export const UPGRADE_COMMAND = 'npm install -g agenzo-merchant-cli@latest';

const FALLBACK_VERSION = '0.1.0';

let cached: string | null = null;

export function getCurrentVersion(): string {
  if (cached !== null) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  // Both the bundled (dist/index.js) and source layouts resolve to package.json.
  const candidates = [
    join(here, '..', 'package.json'),
    join(here, '..', '..', 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(p, 'utf-8')) as { version?: string };
      if (typeof pkg.version === 'string') {
        cached = pkg.version;
        return cached;
      }
    } catch {
      // try the next candidate
    }
  }
  cached = FALLBACK_VERSION;
  return cached;
}

/** Returns negative / zero / positive comparing `a` against `b` (major.minor.patch). */
export function compareVersion(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/, '')
      .split(/[-+]/)[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Throw CLI_OUTDATED (exit code 2) when the local version is below the header floor. */
export function enforceMinVersion(header: string | null): void {
  const min = header?.trim();
  if (!min) return;
  const current = getCurrentVersion();
  if (compareVersion(current, min) < 0) {
    throw new CliError(
      ErrorCodes.CLI_OUTDATED,
      `CLI ${current} is below the required minimum ${min}.`,
      `Upgrade: ${UPGRADE_COMMAND}`,
      2,
    );
  }
}
