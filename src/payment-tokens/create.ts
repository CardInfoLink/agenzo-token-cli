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
    .description('Create a payment token')
    .option('--api-key <api_key>', 'API Key')
    .option('--type <type>', 'Token type (vcn, network-token, x402)', 'vcn')
    .option('--payment-method-id <pm_id>', 'Payment method ID (e.g. pm_01KPX...)')
    .option('--member <member_id>', 'Member ID')
    .option('--amount <amount>', 'Amount (cents, 1-50000)')
    .option('--currency <currency>', 'Currency (default: USD)')
    .option('--pay-to <address>', 'Pay-to address (X402)')
    .option('--nonce <nonce>', 'Nonce (X402)')
    .option('--network <network>', 'Network (X402)')
    .option('--deadline <deadline>', 'Deadline Unix timestamp (X402)')
    .option('--external-tx-id <id>', 'External transaction ID')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const paymentMethodId = await PromptEngine.resolveInput(options.paymentMethodId, {
        message: 'Payment method ID:',
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
        message: 'External transaction ID:',
      });

      const body: Record<string, unknown> = {
        type: apiType,
        payment_method_id: paymentMethodId,
        member_id: memberId,
        external_transaction_id: externalTxId,
      };

      if (apiType === 'vcn') {
        const amount = await PromptEngine.resolveInput(options.amount, {
          message: 'Amount (cents, 1-50000):',
        });
        body.amount = Number(amount);
        if (options.currency) {
          body.currency = options.currency;
        }
      } else if (apiType === 'x402') {
        body.pay_to = await PromptEngine.resolveInput(options.payTo, {
          message: 'Pay-to address:',
        });
        body.amount = await PromptEngine.resolveInput(options.amount, {
          message: 'Amount (USDC smallest unit):',
        });
        body.nonce = await PromptEngine.resolveInput(options.nonce, {
          message: 'Nonce:',
        });
        body.network = await PromptEngine.resolveInput(options.network, {
          message: 'Network:',
        });
        const deadline = await PromptEngine.resolveInput(options.deadline, {
          message: 'Deadline (Unix timestamp):',
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
        console.log(Formatter.status('success', 'Payment token created'));
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
      console.log(
        Formatter.status('info', 'Use the Signature Value in the X-PAYMENT request header'),
      );
      break;
  }
}
