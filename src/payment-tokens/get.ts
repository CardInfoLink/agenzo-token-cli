import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('get <payment_token_id>')
    .description('View payment token details')
    .option('--api-key <api_key>', 'API Key')
    .action(async (paymentTokenId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const result = await deps.apiClient.get<Record<string, unknown>>(
        `/payment-tokens/${paymentTokenId}`,
        { type: 'api-key', key: apiKey },
      );

      if (result.success) {
        formatPaymentToken(result.data);
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}

function formatPaymentToken(data: Record<string, unknown>): void {
  const type = String(data.type ?? '');
  const id = String(data.id ?? '');
  const status = String(data.status ?? '');

  if (type === 'vcn') {
    const vcn = (data.vcn as Record<string, unknown>) ?? {};
    console.log(
      Formatter.keyValue([
        ['Token ID', id],
        ['Type', 'VCN'],
        ['Card Number', String(vcn.pan ?? '-')],
        ['Expiry', String(vcn.expiry ?? '-')],
        ['CVC', String(vcn.cvv ?? '-')],
        ['Last 4', String(vcn.last4 ?? '-')],
        ['Limit', `$${(Number(vcn.spend_limit_cents ?? 0) / 100).toFixed(2)}`],
        ['Balance', `$${(Number(vcn.balance_cents ?? 0) / 100).toFixed(2)}`],
        ['Currency', String(vcn.currency ?? 'USD')],
        ['Status', String(vcn.status ?? status)],
      ]),
    );
  } else if (type === 'network_token') {
    const nt = (data.network_token as Record<string, unknown>) ?? {};
    console.log(
      Formatter.keyValue([
        ['Token ID', id],
        ['Type', 'Network Token'],
        ['Brand', String(nt.payment_brand ?? nt.brand ?? '-')],
        ['ECI', String(nt.eci ?? '-')],
        ['Cryptogram', String(nt.token_cryptogram ?? '-')],
        ['Expiry', String(nt.expiry_date ?? '-')],
        ['Value', String(nt.value ?? '-')],
        ['Status', status],
      ]),
    );
  } else if (type === 'x402') {
    const x402 = (data.x402 as Record<string, unknown>) ?? {};
    console.log(
      Formatter.keyValue([
        ['Token ID', id],
        ['Type', 'X402'],
        ['Status', status],
        ['Signature Value', String(x402.signature_value ?? '-')],
      ]),
    );
  } else {
    console.log(Formatter.keyValue([
      ['Token ID', id],
      ['Type', type],
      ['Status', status],
    ]));
  }
}
