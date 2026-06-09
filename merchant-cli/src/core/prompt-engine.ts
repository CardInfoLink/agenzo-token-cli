import { confirm, input, password, select } from '@inquirer/prompts';

export interface ResolveOptions {
  message: string;
  type?: 'input' | 'password' | 'select';
  choices?: { name: string; value: string }[];
  validate?: (value: string) => boolean | string;
}

/**
 * Interactive resolution for missing required parameters (api-key,
 * idempotency-key, etc.). When a flag value is supplied it is returned as-is.
 */
export class PromptEngine {
  static async resolveInput(
    flagValue: string | undefined,
    options: ResolveOptions,
  ): Promise<string> {
    if (flagValue !== undefined) return flagValue;
    if (options.type === 'password') {
      return password({ message: options.message, mask: '*' });
    }
    if (options.type === 'select' && options.choices) {
      return select({ message: options.message, choices: options.choices });
    }
    return input({ message: options.message, validate: options.validate });
  }

  /** Confirmation prompt; auto-approves when `--yes` is set. */
  static async confirm(message: string, yes: boolean): Promise<boolean> {
    if (yes) return true;
    return confirm({ message });
  }
}
