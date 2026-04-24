import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { PaymentMethod } from '../types/api.js';

export function registerAddCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('add')
    .description('Add a payment method')
    .option('--api-key <api_key>', 'API Key')
    .option('--type <type>', 'Payment type', 'card')
    .option('--card-email <email>', 'Email for 3DS verification')
    .option('--card-number <card_number>', 'Card number')
    .option('--expiry <expiry>', 'Expiry (MMYY)')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const params = await PromptEngine.collectPaymentMethodParams(
        options.type,
        options,
      );

      const result = await deps.apiClient.post<PaymentMethod>(
        '/payment-methods/create',
        { type: 'api-key', key: apiKey },
        params,
      );

      if (result.success) {
        const pm = result.data;
        console.log(Formatter.status('success', 'Payment method added'));
        const entries: [string, string][] = [
          ['PM ID', pm.id],
          ['Type', pm.type],
          ['Status', pm.status],
        ];
        if (pm.brand) entries.push(['Brand', pm.brand]);
        if (pm.last_four) entries.push(['Last 4', pm.last_four]);
        if (pm.magic_link_token) entries.push(['Magic Link Token', pm.magic_link_token]);
        if (pm.expires_at) entries.push(['Expires', pm.expires_at]);
        console.log(Formatter.keyValue(entries));

        if (options.type === 'card') {
          console.log(
            Formatter.status('info', 'Complete 3DS verification via email to activate'),
          );
        }
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
