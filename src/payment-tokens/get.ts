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
    .description('查看支付令牌详情')
    .option('--key <api_key>', 'API Key')
    .action(async (paymentTokenId: string, options) => {
      const apiKey = await PromptEngine.resolveInput(options.key, {
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
          ['类型', 'VCN'],
          ['卡号', token.card_number],
          ['有效期', token.expiry],
          ['CVC', token.cvc],
          ['后四位', token.last_four],
          ['限额', String(token.amount_limit)],
          ['货币', token.currency],
          ['状态', token.status],
        ]),
      );
      break;
    case 'network_token':
      console.log(
        Formatter.keyValue([
          ['Token ID', token.id],
          ['类型', 'Network Token'],
          ['品牌', token.brand],
          ['前六位', token.token_first_six],
          ['后四位', token.token_last_four],
          ['ECI', token.eci],
          ['Cryptogram', token.cryptogram],
          ['有效期', token.expiry],
          ['Value', token.value],
        ]),
      );
      break;
    case 'x402':
      console.log(
        Formatter.keyValue([
          ['Token ID', token.id],
          ['类型', 'X402'],
          ['状态', token.status],
          ['Signature Value', token.signature_value],
        ]),
      );
      break;
  }
}
