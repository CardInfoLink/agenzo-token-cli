import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { select } from '@inquirer/prompts';
import { ApiClient } from '../api/client.js';
import { PaymentMethod, PaymentToken } from '../types/api.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';

/** Format card display: first6****last4 Brand */
function formatCardLabel(pm: PaymentMethod): string {
  const first6 = pm.first6 ?? '??????';
  const last4 = pm.last4 ?? '????';
  const brand = pm.brand ?? 'Unknown';
  return `${first6}****${last4}  ${brand}`;
}

/** Fetch payment methods and let user pick one interactively. */
async function selectPaymentMethod(
  apiClient: ApiClient,
  apiKey: string,
): Promise<string> {
  console.log(Formatter.status('loading', 'Fetching payment methods...'));

  const result = await apiClient.get<PaymentMethod[]>(
    '/payment-methods',
    { type: 'api-key', key: apiKey },
  );

  if (!result.success) {
    console.error(Formatter.status('error', `Failed to list payment methods: ${result.errorMessage}`));
    process.exit(1);
  }

  const methods = result.data.filter((pm) => pm.status === 'ACTIVE');
  if (methods.length === 0) {
    console.error(Formatter.status('error', 'No active payment methods found. Add one first with: payment-methods add'));
    process.exit(1);
  }

  if (methods.length === 1) {
    console.log(Formatter.status('info', `Using payment method: ${formatCardLabel(methods[0])}`));
    return methods[0].id;
  }

  // Multiple cards — let user choose (no pm_id shown)
  const choices = methods.map((pm) => ({
    name: formatCardLabel(pm),
    value: pm.id,
  }));

  return select({
    message: 'Select payment method:',
    choices,
  });
}

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
    .option('--amount <amount>', 'Amount in USD (0.01-500.00)')
    .option('--currency <currency>', 'Currency (default: USD)')
    .option('--pay-to <address>', 'Pay-to address (X402)')
    .option('--nonce <nonce>', 'Nonce (X402)')
    .option('--network <network>', 'Network (X402)')
    .option('--deadline <deadline>', 'Deadline Unix timestamp (X402)')
    .option('--external-tx-id <id>', 'External transaction ID (auto-generated if omitted)')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      // If --payment-method-id provided, use it; otherwise fetch list and let user pick
      let paymentMethodId: string;
      if (options.paymentMethodId) {
        paymentMethodId = options.paymentMethodId;
      } else {
        paymentMethodId = await selectPaymentMethod(deps.apiClient, apiKey);
      }

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

      const externalTxId = options.externalTxId ?? randomUUID();

      const body: Record<string, unknown> = {
        type: apiType,
        payment_method_id: paymentMethodId,
        member_id: memberId,
        external_transaction_id: externalTxId,
      };

      if (apiType === 'vcn') {
        const amountStr = await PromptEngine.resolveInput(options.amount, {
          message: 'Amount in USD (0.01-500.00):',
        });
        const amountUsd = parseFloat(amountStr);
        if (isNaN(amountUsd) || amountUsd < 0.01 || amountUsd > 500) {
          console.error(Formatter.status('error', 'Amount must be between 0.01 and 500.00 USD'));
          return;
        }
        body.amount = Math.round(amountUsd * 100); // Convert USD to cents for API
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

      console.log(Formatter.status('loading', 'Creating payment token...'));

      const idempotencyKey = randomUUID();
      const result = await deps.apiClient.post<PaymentToken>(
        '/payment-tokens/create',
        { type: 'api-key', key: apiKey },
        body,
        { 'Idempotency-Key': idempotencyKey },
      );

      if (result.success) {
        console.log(Formatter.status('success', 'Payment token created'));
        formatPaymentToken(result.data as unknown as Record<string, unknown>);
      } else {
        console.error(Formatter.status('error', result.errorMessage));
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
        ['Limit', `${(Number(vcn.spend_limit_cents ?? 0) / 100).toFixed(2)}`],
        ['Balance', `${(Number(vcn.balance_cents ?? 0) / 100).toFixed(2)}`],
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
        ['Token Card', String(nt.last4_no ?? '-')],
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
    console.log(
      Formatter.status('info', 'Use the Signature Value in the X-PAYMENT request header'),
    );
  } else {
    console.log(Formatter.keyValue([
      ['Token ID', id],
      ['Type', type],
      ['Status', status],
    ]));
  }
}
