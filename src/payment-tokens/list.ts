import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';

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

      const result = await deps.apiClient.get<Record<string, unknown>[]>(
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
          String(t.id ?? ''),
          String(t.type ?? ''),
          String(t.status ?? '-'),
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

function getSummary(data: Record<string, unknown>): string {
  const type = String(data.type ?? '');

  if (type === 'vcn') {
    const vcn = (data.vcn as Record<string, unknown>) ?? {};
    return `****${vcn.last4 ?? '?'} $${(Number(vcn.spend_limit_cents ?? 0) / 100).toFixed(2)}`;
  }
  if (type === 'network_token') {
    const nt = (data.network_token as Record<string, unknown>) ?? {};
    return `${nt.payment_brand ?? '-'} ****${nt.last4_no ?? '?'}`;
  }
  if (type === 'x402') {
    const x402 = (data.x402 as Record<string, unknown>) ?? {};
    const sig = String(x402.signature_value ?? '');
    return sig ? sig.slice(0, 16) + '...' : '-';
  }
  return '-';
}
