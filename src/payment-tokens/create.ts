import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { select, confirm } from '@inquirer/prompts';
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

/** Fetch payment methods and resolve which one to use.
 *
 * Priority:
 * 1. --payment-method-id flag → use directly
 * 2. --card flag → match by last4 from card list
 * 3. Only 1 active card → auto-select
 * 4. Multiple cards → interactive selection
 */
async function resolvePaymentMethod(
  apiClient: ApiClient,
  apiKey: string,
  cardNumber?: string,
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

  // If --card provided, match by last4
  if (cardNumber) {
    const last4 = cardNumber.slice(-4);
    const matched = methods.find((pm) => pm.last4 === last4);
    if (!matched) {
      console.error(Formatter.status('error', `No active card ending in ${last4} found`));
      process.exit(1);
    }
    console.log(Formatter.status('info', `Matched card: ${formatCardLabel(matched)}`));
    return matched.id;
  }

  // Only 1 card → auto-select
  if (methods.length === 1) {
    console.log(Formatter.status('info', `Using payment method: ${formatCardLabel(methods[0])}`));
    return methods[0].id;
  }

  // Multiple cards → interactive selection
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
    .option('--card <card_number>', 'Card number to match (matches by last 4 digits)')
    .option('--member <member_id>', 'Member ID')
    .option('--amount <amount>', 'Amount in USD (0.01-500.00)')
    .option('--currency <currency>', 'Currency (default: USD)')
    .option('--pay-to <address>', 'Pay-to address (X402)')
    .option('--nonce <nonce>', 'Nonce (X402)')
    .option('--network <network>', 'Network (X402)')
    .option('--deadline <deadline>', 'Deadline Unix timestamp (X402)')
    .option('--external-tx-id <id>', 'External transaction ID (auto-generated if omitted)')
    .action(async (options, command) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      // Resolve payment method: --payment-method-id > --card > auto/interactive
      let paymentMethodId: string;
      if (options.paymentMethodId) {
        paymentMethodId = options.paymentMethodId;
      } else {
        paymentMethodId = await resolvePaymentMethod(deps.apiClient, apiKey, options.card);
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

      // Confirmation for VCN and X402 (involves pre-auth freeze)
      // Walk up command chain to find root --yes flag
      let root = command;
      while (root.parent) root = root.parent;
      const skipConfirm = root.opts().yes === true;
      if (!skipConfirm && (apiType === 'vcn' || apiType === 'x402')) {
        const amountDisplay = apiType === 'vcn'
          ? `$${(Number(body.amount) / 100).toFixed(2)}`
          : `${body.amount} (smallest unit)`;
        const frozenDisplay = apiType === 'vcn'
          ? `$${(Number(body.amount) * 1.05 / 100).toFixed(2)}`
          : `${body.amount} + 5% fee`;

        console.log(Formatter.status('warning', `This will freeze ${frozenDisplay} on your card (${amountDisplay} + 5% service fee).`));
        const confirmed = await confirm({
          message: 'Proceed with pre-authorization?',
          default: true,
        });
        if (!confirmed) {
          console.log(Formatter.status('info', 'Cancelled.'));
          return;
        }
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
    const limitCents = Number(vcn.spend_limit_cents ?? 0);
    const limitUsd = (limitCents / 100).toFixed(2);
    const frozenUsd = (limitCents * 1.05 / 100).toFixed(2);
    console.log(
      Formatter.keyValue([
        ['Token ID', id],
        ['Type', 'VCN'],
        ['Card Number', String(vcn.pan ?? '-')],
        ['Expiry', String(vcn.expiry ?? '-')],
        ['CVC', String(vcn.cvv ?? '-')],
        ['Last 4', String(vcn.last4 ?? '-')],
        ['Limit', limitUsd],
        ['Balance', `${(Number(vcn.balance_cents ?? 0) / 100).toFixed(2)}`],
        ['Currency', String(vcn.currency ?? 'USD')],
        ['Status', String(vcn.status ?? status)],
      ]),
    );
    console.log(Formatter.status('warning', `Pre-auth frozen: $${frozenUsd} ($${limitUsd} + 5% service fee). Capture will also include 5% fee.`));
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
    console.log(Formatter.status('warning', 'Pre-auth frozen: amount + 5% service fee. Capture will also include 5% fee.'));
  } else {
    console.log(Formatter.keyValue([
      ['Token ID', id],
      ['Type', type],
      ['Status', status],
    ]));
  }
}
