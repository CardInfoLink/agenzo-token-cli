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
        const entries: [string, string][] = [
          ['Token ID', result.data.id],
        ];
        if (result.data.expires_at) {
          entries.push([
            'Expires At',
            result.data.message
              ? `${Formatter.formatTime(result.data.expires_at)} (${result.data.message})`
              : Formatter.formatTime(result.data.expires_at),
          ]);
        } else {
          entries.push(['Revoked At', Formatter.formatTime(result.data.revoked_at)]);
          if (result.data.message) {
            entries.push(['Note', result.data.message]);
          }
        }
        console.log(Formatter.keyValue(entries));
      } else {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
      }
    });
}
