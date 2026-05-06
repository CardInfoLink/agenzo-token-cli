import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter, createSpinner } from '../utils/formatter.js';
import { PaymentMethod } from '../types/api.js';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function registerAddCommand(
  parent: Command,
  deps: { apiClient: ApiClient },
): void {
  parent
    .command('add')
    .description('Add a payment method')
    .option('--api-key <api_key>', 'API Key')
    .option('--type <type>', 'Payment type', 'card')
    .option('--email <email>', 'Email for 3DS verification')
    .option('--card-number <card_number>', 'Card number')
    .option('--expiry <expiry>', 'Expiry (MMYY)')
    .option('--cvv <cvv>', 'CVV (use stdin pipe for better security)')
    .action(async (options) => {
      const apiKey = await PromptEngine.resolveInput(options.apiKey, {
        message: 'API Key:',
      });

      const params = await PromptEngine.collectPaymentMethodParams(
        options.type,
        options,
      );

      const spinner = createSpinner('Adding payment method');
      const result = await deps.apiClient.post<PaymentMethod>(
        '/payment-methods/create',
        { type: 'api-key', key: apiKey },
        params,
      );
      spinner.stop();

      if (!result.success) {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
        return;
      }

      const pm = result.data;
      console.log(Formatter.status('success', 'Payment method created'));
      console.log(Formatter.keyValue([
        ['PM ID', pm.id],
        ['Type', pm.type],
        ['Status', pm.status],
      ]));

      if (options.type === 'card' && pm.status === 'PENDING') {
        console.log(
          Formatter.status('info', 'Complete 3DS verification via email to activate'),
        );

        const finalPm = await pollVerificationStatus(deps.apiClient, apiKey, pm.id);

        if (finalPm.status === 'ACTIVE') {
          console.log(Formatter.status('success', 'Payment method activated'));
          const entries: [string, string][] = [
            ['PM ID', finalPm.id],
            ['Brand', finalPm.brand ?? '-'],
            ['First 6', finalPm.first6 ?? '-'],
            ['Last 4', finalPm.last4 ?? '-'],
            ['Status', finalPm.status],
          ];
          console.log(Formatter.keyValue(entries));
        } else if (finalPm.status === 'FAILED') {
          console.error(Formatter.status('error', '3DS verification failed'));
        } else {
          console.error(
            Formatter.status('error', 'Verification timed out (15 min). Check status with:'),
          );
          console.log(`  agenzo-token-cli payment-methods get ${pm.id} --api-key <your_key>`);
        }
      }
    });
}

async function pollVerificationStatus(
  apiClient: ApiClient,
  apiKey: string,
  pmId: string,
): Promise<PaymentMethod> {
  const startTime = Date.now();
  const spinner = createSpinner('Waiting for 3DS verification');

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const result = await apiClient.get<PaymentMethod>(
      '/payment-methods/verification/status',
      { type: 'api-key', key: apiKey },
      { payment_method_id: pmId },
    );

    if (result.success) {
      const status = result.data.status;
      if (status === 'ACTIVE' || status === 'FAILED') {
        spinner.stop();
        return result.data;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  spinner.stop();
  return { id: pmId, status: 'PENDING' } as PaymentMethod;
}
