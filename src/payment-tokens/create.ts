import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { select, confirm, input } from '@inquirer/prompts';
import { ApiClient } from '../api/client.js';
import { PaymentMethod, PaymentToken } from '../types/api.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';

/** 5% fee with $0.01 minimum, input and output in cents */
function calcFeeCents(amountCents: number): number {
  return Math.max(1, Math.round(amountCents * 0.05));
}

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
    .option('--type <type>', 'Token type (vcn, network-token, x402)')
    .option('--payment-method-id <pm_id>', 'Payment method ID (e.g. pm_01KPX...)')
    .option('--card <card_number>', 'Card number to match (matches by last 4 digits)')
    .option('--member <member_id>', 'Member ID (optional)')
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

      // Resolve token type: --type flag or interactive selection
      let cliType: string;
      if (options.type) {
        cliType = options.type;
      } else {
        cliType = await select({
          message: 'Token type:',
          choices: [
            { name: 'VCN (Virtual Card Number)', value: 'vcn' },
            { name: 'Network Token', value: 'network-token' },
            { name: 'X402 (Crypto Payment)', value: 'x402' },
          ],
        });
      }

      // Map CLI type to API type
      const typeMap: Record<string, string> = {
        'vcn': 'vcn',
        'network-token': 'network_token',
        'x402': 'x402',
      };
      const apiType = typeMap[cliType] ?? cliType;

      const externalTxId = options.externalTxId ?? randomUUID();

      const body: Record<string, unknown> = {
        type: apiType,
        payment_method_id: paymentMethodId,
        external_transaction_id: externalTxId,
      };
      if (memberId) {
        body.member_id = memberId;
      }

      if (apiType === 'vcn') {
        const amountStr = await PromptEngine.resolveInput(options.amount, {
          message: 'Amount in USD (0.01-500.00):',
        });
        const amountUsd = parseFloat(amountStr);
        if (isNaN(amountUsd) || amountUsd < 0.01 || amountUsd > 500) {
          console.error(Formatter.status('error', 'Amount must be between 0.01 and 500.00 USD'));
          return;
        }
        // Convert USD string to cents via string parsing to avoid
        // floating-point precision issues (e.g. 1.005 * 100 = 100.499...)
        const [whole = '0', frac = ''] = amountStr.split('.');
        const cents = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
        body.amount = cents;
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

      // Member ID (optional, after all type-specific params)
      const memberId = options.member ?? await (async () => {
        const val = await input({ message: 'Member ID (optional, press Enter to skip):' });
        return val.trim() || undefined;
      })();

      // Confirmation — walk up command chain to find root --yes flag
      let root = command;
      while (root.parent) root = root.parent;
      const skipConfirm = root.opts().yes === true;

      if (!skipConfirm && apiType === 'vcn') {
        const amountCents = Number(body.amount);
        const feeCents = calcFeeCents(amountCents);
        const totalCents = amountCents + feeCents;
        const amountDisplay = '$' + (amountCents / 100).toFixed(2);
        const feeDisplay = '$' + (feeCents / 100).toFixed(2);
        const totalDisplay = '$' + (totalCents / 100).toFixed(2);
        console.log(Formatter.status('warning',
          'This will freeze ' + totalDisplay + ' on your card (' + amountDisplay + ' + ' + feeDisplay + ' service fee, minimum $0.01).'));
        const confirmed = await confirm({
          message: 'Proceed with pre-authorization?',
          default: true,
        });
        if (!confirmed) {
          console.log(Formatter.status('info', 'Cancelled.'));
          return;
        }
      }

      if (!skipConfirm && apiType === 'network_token') {
        console.log(Formatter.status('warning', 'A flat $5.00 service fee applies to this Network Token transaction.'));
        const confirmed = await confirm({
          message: 'Proceed?',
          default: true,
        });
        if (!confirmed) {
          console.log(Formatter.status('info', 'Cancelled.'));
          return;
        }
      }

      if (!skipConfirm && apiType === 'x402') {
        const rawAmount = Number(body.amount);
        const USDC_UNIT = 1_000_000;
        const amountUsd = rawAmount / USDC_UNIT;
        const feeUsd = Math.max(0.01, Math.round(amountUsd * 0.05 * 100) / 100);
        const totalUsd = amountUsd + feeUsd;
        console.log(Formatter.status('warning',
          'This will freeze $' + totalUsd.toFixed(2) + ' USDC on your card ($' + amountUsd.toFixed(2) + ' + $' + feeUsd.toFixed(2) + ' service fee, minimum $0.01).'));
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
    const feeCents = calcFeeCents(limitCents);
    const frozenCents = limitCents + feeCents;
    console.log(
      Formatter.keyValue([
        ['Type', 'VCN'],
        ['Card Number', String(vcn.pan ?? '-')],
        ['Expiry', String(vcn.expiry ?? '-')],
        ['CVC', String(vcn.cvv ?? '-')],
        ['Last 4', String(vcn.last4 ?? '-')],
        ['Limit', '$' + (limitCents / 100).toFixed(2)],
        ['Service Fee', '$' + (feeCents / 100).toFixed(2)],
        ['Pre-auth Frozen', '$' + (frozenCents / 100).toFixed(2)],
        ['Balance', '$' + (Number(vcn.balance_cents ?? 0) / 100).toFixed(2)],
        ['Currency', String(vcn.currency ?? 'USD')],
        ['Status', String(vcn.status ?? status)],
      ]),
    );
  } else if (type === 'network_token') {
    const nt = (data.network_token as Record<string, unknown>) ?? {};
    console.log(
      Formatter.keyValue([
        ['Type', 'Network Token'],
        ['Brand', String(nt.payment_brand ?? nt.brand ?? '-')],
        ['Token Card', String(nt.last4_no ?? '-')],
        ['ECI', String(nt.eci ?? '-')],
        ['Cryptogram', String(nt.token_cryptogram ?? '-')],
        ['Expiry', String(nt.expiry_date ?? '-')],
        ['Value', String(nt.value ?? '-')],
        ['Service Fee', '$5.00'],
        ['Status', status],
      ]),
    );
  } else if (type === 'x402') {
    const x402 = (data.x402 as Record<string, unknown>) ?? {};
    console.log(
      Formatter.keyValue([
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
      ['Type', type],
      ['Status', status],
    ]));
  }
}
