import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { PaymentMethod } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('get <pm_id>')
    .description('View payment method details')
    .option('--api-key <api_key>', 'API Key')
    .action(async (pmId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const result = await deps.apiClient.get<PaymentMethod>(
        `/payment-methods/${pmId}`,
        { type: 'api-key', key: apiKey },
      );

      if (result.success) {
        const pm = result.data;
        const entries: [string, string][] = [
          ['PM ID', pm.id],
          ['Type', pm.type],
          ['Status', pm.status],
        ];
        if (pm.brand) entries.push(['Brand', pm.brand]);
        if (pm.first_six) entries.push(['First 6', pm.first_six]);
        if (pm.last_four) entries.push(['Last 4', pm.last_four]);
        entries.push(['Created', pm.created_at]);
        console.log(Formatter.keyValue(entries));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
