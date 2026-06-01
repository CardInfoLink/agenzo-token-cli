import { input } from '@inquirer/prompts';
import { CliError, ErrorCodes } from '../core/errors.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const RULE = 'Use 1-128 characters from [A-Za-z0-9_-].';

/** Validate + normalize a caller-supplied idempotency key. */
export function normalizeIdempotencyKey(key: string): string {
  const trimmed = key.trim();
  if (!KEY_PATTERN.test(trimmed)) {
    throw new CliError(
      ErrorCodes.PARAM_IDEMPOTENCY_KEY_REQUIRED,
      `Invalid idempotency key: "${key}".`,
      RULE,
    );
  }
  return trimmed;
}

/**
 * Resolve the idempotency key for a write operation. The CLI never generates
 * one: if absent and `--yes` is set it is a hard error, otherwise we prompt.
 */
export async function resolveIdempotencyKey(
  flagValue: string | undefined,
  options: { yes?: boolean },
): Promise<string> {
  if (flagValue !== undefined) return normalizeIdempotencyKey(flagValue);
  if (options.yes) {
    throw new CliError(
      ErrorCodes.PARAM_IDEMPOTENCY_KEY_REQUIRED,
      'An idempotency key is required for write operations.',
      'Pass --idempotency-key <key>; the CLI never auto-generates one.',
    );
  }
  const entered = await input({
    message: 'Idempotency key:',
    validate: (v) => KEY_PATTERN.test(v.trim()) || RULE,
  });
  return normalizeIdempotencyKey(entered);
}
