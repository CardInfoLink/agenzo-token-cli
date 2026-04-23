import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { PaymentToken } from '../types/api.js';

export function registerCreateCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('create')
    .description('创建支付令牌')
    .option('--key <api_key>', 'API Key')
    .option('--type <type>', '令牌类型 (vcn, network-token, x402)', 'vcn')
    .option('--payment-method <pm_id>', '支付方式 ID')
    .option('--member <member_id>', 'Member ID')
    .option('--amount <amount>', '金额（美分，1-50000）')
    .option('--currency <currency>', '货币（默认 USD）')
    .option('--pay-to <address>', '收款地址（X402）')
    .option('--nonce <nonce>', 'Nonce（X402）')
    .option('--network <network>', '网络（X402）')
    .option('--deadline <deadline>', 'Deadline Unix 时间戳（X402）')
    .option('--external-tx-id <id>', '外部交易 ID')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.key, {
        message: 'API Key:',
      });

      const paymentMethodId = await PromptEngine.resolveInput(options.paymentMethod, {
        message: '支付方式 ID:',
      });

      const memberId = await PromptEngine.resolveInput(options.member, {
        message: 'Member ID:',
      });

      // Map CLI type to API type
      const typeMap: Record<string, string> = {
        'vcn': 'vcn',
        'network-token': 'network_token',
        'x402': 'x402',
      };
      const apiType = typeMap[options.type] ?? options.type;

      const externalTxId = await PromptEngine.resolveInput(options.externalTxId, {
        message: '外部交易 ID:',
      });

      const body: Record<string, unknown> = {
        type: apiType,
        payment_method_id: paymentMethodId,
        member_id: memberId,
        external_transaction_id: externalTxId,
      };

      if (apiType === 'vcn') {
        const amount = await PromptEngine.resolveInput(options.amount, {
          message: '金额（美分，1-50000）:',
        });
        body.amount = Number(amount);
        if (options.currency) {
          body.currency = options.currency;
        }
      } else if (apiType === 'x402') {
        body.pay_to = await PromptEngine.resolveInput(options.payTo, {
          message: '收款地址:',
        });
        body.amount = await PromptEngine.resolveInput(options.amount, {
          message: '金额（USDC 最小单位）:',
        });
        body.nonce = await PromptEngine.resolveInput(options.nonce, {
          message: 'Nonce:',
        });
        body.network = await PromptEngine.resolveInput(options.network, {
          message: '网络:',
        });
        const deadline = await PromptEngine.resolveInput(options.deadline, {
          message: 'Deadline（Unix 时间戳）:',
        });
        body.deadline = Number(deadline);
      }

      const idempotencyKey = randomUUID();
      const result = await deps.apiClient.post<PaymentToken>(
        '/payment-tokens/create',
        { type: 'api-key', key: apiKey },
        body,
        { 'Idempotency-Key': idempotencyKey },
      );

      if (result.success) {
        console.log(Formatter.status('success', '支付令牌创建成功'));
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
      console.log(
        Formatter.status('info', '请将 Signature Value 用于 X-PAYMENT 请求头'),
      );
      break;
  }
}
