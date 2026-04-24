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
    .description('List payment methods')
    .option('--api-key <api_key>', 'API Key')
    .option('--member <member_id>', 'Filter by member')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
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
          console.log(Formatter.status('info', 'No payment methods found'));
          return;
        }
        const headers = ['ID', 'Type', 'Brand', 'First 6', 'Last 4', 'Status'];
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
