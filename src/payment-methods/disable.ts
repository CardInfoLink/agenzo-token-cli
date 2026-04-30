import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { DisableResult } from '../types/api.js';

export function registerDisableCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('disable <pm_id>')
    .description('Disable payment method')
    .option('--api-key <api_key>', 'API Key')
    .action(async (pmId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const result = await deps.apiClient.post<DisableResult>(
        `/payment-methods/${pmId}/disable`,
        { type: 'api-key', key: apiKey },
      );

      if (result.success) {
        console.log(Formatter.status('success', `Payment method ${pmId} disabled`));
        console.log(
          Formatter.keyValue([
            ['Status', result.data.status],
            ['Revoked tokens', String(result.data.revoked_tokens_count ?? 0)],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
      }
    });
}
