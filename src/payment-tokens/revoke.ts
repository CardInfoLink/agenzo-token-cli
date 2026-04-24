import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { RevokeResult } from '../types/api.js';

export function registerRevokeCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('revoke <payment_token_id>')
    .description('Revoke a payment token')
    .option('--api-key <api_key>', 'API Key')
    .action(async (paymentTokenId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const result = await deps.apiClient.post<RevokeResult>(
        `/payment-tokens/${paymentTokenId}/revoke`,
        { type: 'api-key', key: apiKey },
      );

      if (result.success) {
        console.log(Formatter.status('success', 'Payment token revoked'));
        console.log(
          Formatter.keyValue([
            ['Token ID', result.data.id],
            ['Status', result.data.status],
            ['Revoked At', result.data.revoked_at],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
