import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { PaymentToken } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('list')
    .description('List payment tokens')
    .option('--api-key <api_key>', 'API Key')
    .option('--type <type>', 'Filter by type')
    .option('--member <member_id>', 'Filter by member')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const params: Record<string, string> = {};
      if (options.type) params.type = options.type;
      if (options.member) params.member_id = options.member;

      const result = await deps.apiClient.get<PaymentToken[]>(
        '/payment-tokens',
        { type: 'api-key', key: apiKey },
        params,
      );

      if (result.success) {
        if (result.data.length === 0) {
          console.log(Formatter.status('info', 'No payment tokens found'));
          return;
        }
        const headers = ['Token ID', 'Type', 'Status', 'Summary'];
        const rows = result.data.map((t) => [
          t.id,
          t.type,
          getStatus(t),
          getSummary(t),
        ]);
        console.log(Formatter.table(headers, rows));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}

function getStatus(token: PaymentToken): string {
  if (token.type === 'vcn' || token.type === 'x402') {
    return token.status;
  }
  return '-';
}

function getSummary(token: PaymentToken): string {
  switch (token.type) {
    case 'vcn':
      return `****${token.last_four} ${token.amount_limit} ${token.currency}`;
    case 'network_token':
      return `${token.brand} ${token.token_first_six}...${token.token_last_four}`;
    case 'x402':
      return token.signature_value.slice(0, 16) + '...';
  }
}
