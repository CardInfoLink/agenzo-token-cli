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
    .description('查看支付方式详情')
    .option('--key <api_key>', 'API Key')
    .action(async (pmId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.key, {
        message: 'API Key:',
      });

      const result = await deps.apiClient.get<PaymentMethod>(
        `/payment-methods/${pmId}`,
        { type: 'api-key', key: apiKey },
      );

      if (result.success) {
        const pm = result.data;
        const entries: [string, string][] = [
          ['支付方式 ID', pm.id],
          ['类型', pm.type],
          ['状态', pm.status],
        ];
        if (pm.brand) entries.push(['品牌', pm.brand]);
        if (pm.first_six) entries.push(['前六位', pm.first_six]);
        if (pm.last_four) entries.push(['后四位', pm.last_four]);
        entries.push(['创建时间', pm.created_at]);
        console.log(Formatter.keyValue(entries));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
