import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { PaymentToken } from '../types/api.js';

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

      const result = await deps.apiClient.get<PaymentToken>(
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

function formatPaymentToken(token: PaymentToken): void {
  switch (token.type) {
    case 'vcn':
      console.log(
        Formatter.keyValue([
          ['Token ID', token.id],
          ['Type', 'VCN'],
          ['Card Number', token.card_number],
          ['Expiry', token.expiry],
          ['CVC', token.cvc],
          ['Last 4', token.last_four],
          ['Limit', String(token.amount_limit)],
          ['Currency', token.currency],
          ['Status', token.status],
        ]),
      );
      break;
    case 'network_token':
      console.log(
        Formatter.keyValue([
          ['Token ID', token.id],
          ['Type', 'Network Token'],
          ['Brand', token.brand],
          ['First 6', token.token_first_six],
          ['Last 4', token.token_last_four],
          ['ECI', token.eci],
          ['Cryptogram', token.cryptogram],
          ['Expiry', token.expiry],
          ['Value', token.value],
        ]),
      );
      break;
    case 'x402':
      console.log(
        Formatter.keyValue([
          ['Token ID', token.id],
          ['Type', 'X402'],
          ['Status', token.status],
          ['Signature Value', token.signature_value],
        ]),
      );
      break;
  }
}
