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
        const isDeferred = result.data.status === 'ACTIVE' && result.data.expires_at;
        const statusMsg = isDeferred
          ? 'Revoke scheduled (cryptogram will auto-expire)'
          : 'Payment token revoked';
        console.log(Formatter.status('success', statusMsg));

        const entries: [string, string][] = [
          ['Token ID', result.data.id],
          ['Status', result.data.status],
        ];
        if (result.data.expires_at) {
          entries.push([
            'Expires At',
            result.data.message
              ? `${Formatter.formatTime(result.data.expires_at)} (${result.data.message})`
              : Formatter.formatTime(result.data.expires_at),
          ]);
        }
        if (result.data.revoked_at) {
          entries.push(['Revoked At', Formatter.formatTime(result.data.revoked_at)]);
        }
        if (result.data.message && !result.data.expires_at) {
          entries.push(['Note', result.data.message]);
        }
        console.log(Formatter.keyValue(entries));
      } else {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
      }
    });
}
