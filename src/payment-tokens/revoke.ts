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
    .description('撤销支付令牌')
    .option('--key <api_key>', 'API Key')
    .action(async (paymentTokenId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.key, {
        message: 'API Key:',
      });

      const result = await deps.apiClient.post<RevokeResult>(
        `/payment-tokens/${paymentTokenId}/revoke`,
        { type: 'api-key', key: apiKey },
      );

      if (result.success) {
        console.log(Formatter.status('success', '支付令牌已撤销'));
        console.log(
          Formatter.keyValue([
            ['Token ID', result.data.id],
            ['状态', result.data.status],
            ['撤销时间', result.data.revoked_at],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
