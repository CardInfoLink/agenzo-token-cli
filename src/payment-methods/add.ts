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
    .description('添加支付方式')
    .option('--key <api_key>', 'API Key')
    .option('--type <type>', '支付类型', 'card')
    .option('--email <email>', '邮箱')
    .option('--card-number <card_number>', '卡号')
    .option('--expiry <expiry>', '有效期 (MMYY)')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.key, {
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
        console.log(Formatter.status('success', '支付方式添加成功'));
        const entries: [string, string][] = [
          ['支付方式 ID', pm.id],
          ['类型', pm.type],
          ['状态', pm.status],
        ];
        if (pm.brand) entries.push(['品牌', pm.brand]);
        if (pm.last_four) entries.push(['后四位', pm.last_four]);
        if (pm.magic_link_token) entries.push(['Magic Link Token', pm.magic_link_token]);
        if (pm.expires_at) entries.push(['过期时间', pm.expires_at]);
        console.log(Formatter.keyValue(entries));

        if (options.type === 'card') {
          console.log(
            Formatter.status('info', '请到邮箱完成 3DS 验证以激活支付方式'),
          );
        }
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
