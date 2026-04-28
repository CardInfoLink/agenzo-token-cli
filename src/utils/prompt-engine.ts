import { input, password, select } from '@inquirer/prompts';

interface PromptConfig {
  message: string;
  type?: 'input' | 'password' | 'select';
  choices?: { name: string; value: string }[];
  validate?: (input: string) => boolean | string;
}

export class PromptEngine {
  /** Return flagValue directly if provided, otherwise prompt interactively */
  static async resolveInput(
    flagValue: string | undefined,
    config: PromptConfig,
  ): Promise<string> {
    if (flagValue !== undefined) {
      return flagValue;
    }

    if (config.type === 'password') {
      return password({ message: config.message, mask: '*' });
    }

    if (config.type === 'select' && config.choices) {
      return select({
        message: config.message,
        choices: config.choices,
      });
    }

    return input({
      message: config.message,
      validate: config.validate,
    });
  }

  /** Always collect CVV interactively with masked display */
  static async collectCvv(): Promise<string> {
    return password({
      message: 'CVV:',
      mask: '*',
    });
  }

  /** Collect payment method params based on type */
  static async collectPaymentMethodParams(
    type: string,
    flags: Record<string, string | undefined>,
  ): Promise<Record<string, string>> {
    const params: Record<string, string> = { type };

    const email = await PromptEngine.resolveInput(flags.cardEmail ?? flags.email, {
      message: 'Email (for 3DS verification):',
    });
    params.email = email;

    if (type === 'card') {
      params.card_number = await PromptEngine.resolveInput(flags.cardNumber, {
        message: 'Card number:',
      });
      params.expiry_date = await PromptEngine.resolveInput(flags.expiry, {
        message: 'Expiry (MMYY):',
      });
      // CVV: use flag if provided, otherwise collect interactively
      if (flags.cvv) {
        params.cvv = flags.cvv;
      } else {
        params.cvv = await PromptEngine.collectCvv();
      }
    }

    return params;
  }
}
