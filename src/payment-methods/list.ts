import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { PaymentMethod } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('list')
    .description('列出支付方式')
    .option('--key <api_key>', 'API Key')
    .option('--member <member_id>', '按 member 过滤')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.key, {
        message: 'API Key:',
      });

      const params: Record<string, string> = {};
      if (options.member) params.member_id = options.member;

      const result = await deps.apiClient.get<PaymentMethod[]>(
        '/payment-methods',
        { type: 'api-key', key: apiKey },
        params,
      );

      if (result.success) {
        if (result.data.length === 0) {
          console.log(Formatter.status('info', '暂无支付方式'));
          return;
        }
        const headers = ['ID', '类型', '品牌', '前六位', '后四位', '状态'];
        const rows = result.data.map((pm) => [
          pm.id,
          pm.type,
          pm.brand ?? '-',
          pm.first_six ?? '-',
          pm.last_four ?? '-',
          pm.status,
        ]);
        console.log(Formatter.table(headers, rows));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
