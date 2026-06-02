import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { ConfigManager } from '../config/config-manager.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter, createSpinner } from '../utils/formatter.js';
import { DropinCreateResponse, PaymentMethod } from '../types/api.js';

// Manual mode (3DS via email): the user clicks the magic link in their
// inbox, so polling is short and tight.
const MANUAL_POLL_INTERVAL_MS = 3000;
const MANUAL_POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Drop-in mode (v3): the user-facing add-payment-method form is rendered
// by Evo DropInSDK in the developer's own front-end. 30 minutes covers
// slow integrations / manual QA without forcing the operator to re-run
// the command. Backend returns status=EXPIRED if the user does not finish
// in time.
const DROPIN_POLL_INTERVAL_MS = 5000;
const DROPIN_POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Backend writes one of these into PaymentMethod.status when the
// verification flow reaches a final state. We stop polling on any of them.
const TERMINAL_STATUSES = new Set(['ACTIVE', 'FAILED', 'EXPIRED']);

type AddCommandDeps = {
  apiClient: ApiClient;
  configManager: ConfigManager;
};

export function registerAddCommand(
  parent: Command,
  deps: AddCommandDeps,
): void {
  parent
    .command('add')
    .description('Add a payment method')
    .option('--api-key <api_key>', 'API Key')
    .option('--type <type>', 'Payment type', 'card')
    .option(
      '--mode <mode>',
      'Mode: "manual" (default, CLI collects card details and polls 3DS) or "dropin" (mint a Drop-in session and poll until the user finishes adding the payment method in the browser)',
      'manual',
    )
    .option(
      '--email <email>',
      'In manual mode: email for 3DS verification. In dropin mode: email used as LinkPay reference when adding the payment method.',
    )
    .option('--card-number <card_number>', 'Card number (manual mode only)')
    .option('--expiry <expiry>', 'Expiry (MMYY) (manual mode only)')
    .option(
      '--cvv <cvv>',
      'CVV (manual mode only; use stdin pipe for better security)',
    )
    .action(async (options) => {
      const mode = String(options.mode ?? 'manual').toLowerCase();

      if (mode !== 'manual' && mode !== 'dropin') {
        console.error(
          Formatter.status(
            'error',
            `Unknown --mode "${options.mode}". Expected "manual" or "dropin".`,
          ),
        );
        process.exitCode = 1;
        return;
      }

      if (mode === 'dropin') {
        await handleDropinMode(deps, options);
        return;
      }

      await handleManualMode(deps, options);
    });
}

/**
 * Manual mode: original flow. Collect card details, POST to
 * /payment-methods/create, then poll 3DS verification status.
 */
async function handleManualMode(
  deps: AddCommandDeps,
  options: Record<string, string | undefined>,
): Promise<void> {
  const apiKey = await PromptEngine.resolveInput(options.apiKey, {
    message: 'API Key:',
  });

  const params = await PromptEngine.collectPaymentMethodParams(
    options.type ?? 'card',
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
    console.error(Formatter.status('error', result.errorMessage));
    return;
  }

  const pm = result.data;
  console.log(Formatter.status('success', 'Payment method created'));
  console.log(
    Formatter.keyValue([
      ['PM ID', pm.id],
      ['Type', pm.type],
      ['Status', pm.status],
    ]),
  );

  if (options.type === 'card' && pm.status === 'PENDING') {
    console.log(
      Formatter.status(
        'info',
        'Complete 3DS verification via email to activate',
      ),
    );

    const finalPm = await pollVerificationStatus(deps.apiClient, apiKey, pm.id, {
      intervalMs: MANUAL_POLL_INTERVAL_MS,
      timeoutMs: MANUAL_POLL_TIMEOUT_MS,
      spinnerMessage: 'Waiting for 3DS verification',
    });

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
        Formatter.status(
          'error',
          'Verification timed out (15 min). Check status with:',
        ),
      );
      console.log(
        `  agenzo-token-cli payment-methods get ${pm.id} --api-key <your_key>`,
      );
    }
  }
}

/**
 * Drop-in mode (v3): hand off the add-payment-method UI to the developer's
 * own front-end, which embeds the Evo DropInSDK using the session_id we
 * mint here.
 *
 * Flow:
 *   1. ask for API key + email,
 *   2. POST /payment-methods/dropin/create (v3, API Key auth) — backend
 *      creates a PENDING PM row keyed by pm_id and mints a LinkPay session,
 *   3. print pm_id + session_id so the caller can plug them into their
 *      front-end DropInSDK,
 *   4. poll GET /payment-methods/verification/status?payment_method_id=...
 *      (same endpoint as manual mode) until the PM transitions to a
 *      terminal status (ACTIVE / FAILED / EXPIRED) or we time out at 30min.
 */
async function handleDropinMode(
  deps: AddCommandDeps,
  options: Record<string, string | undefined>,
): Promise<void> {
  const apiKey = await PromptEngine.resolveInput(options.apiKey, {
    message: 'API Key:',
  });

  const email = await PromptEngine.resolveInput(options.email, {
    message: 'Email:',
  });

  // 1) Create Drop-in session via v3 (API Key auth, normal /api/v3/agent-pay base)
  const sessionSpinner = createSpinner('Adding payment method');
  const sessionResult = await deps.apiClient.post<DropinCreateResponse>(
    '/payment-methods/dropin/create',
    { type: 'api-key', key: apiKey },
    { email },
  );
  sessionSpinner.stop();

  if (!sessionResult.success) {
    console.error(Formatter.status('error', sessionResult.errorMessage));
    process.exitCode = 1;
    return;
  }

  const session = sessionResult.data;
  const pmId = session.id;

  console.log(Formatter.status('success', 'Drop-in session created'));
  console.log(
    Formatter.keyValue([
      ['Session ID', session.session_id || '-'],
    ]),
  );

  // 2) Poll verification/status (same endpoint manual mode uses) until
  // the PM reaches a terminal status or we time out.
  const finalPm = await pollVerificationStatus(deps.apiClient, apiKey, pmId, {
    intervalMs: DROPIN_POLL_INTERVAL_MS,
    timeoutMs: DROPIN_POLL_TIMEOUT_MS,
    spinnerMessage: 'Waiting for payment method to be added',
  });

  if (finalPm.status === 'ACTIVE') {
    console.log(Formatter.status('success', 'Payment method activated'));
    console.log(
      Formatter.keyValue([
        ['PM ID', finalPm.id],
        ['Brand', finalPm.brand ?? '-'],
        ['First 6', finalPm.first6 ?? '-'],
        ['Last 4', finalPm.last4 ?? '-'],
        ['Status', finalPm.status],
      ]),
    );
    return;
  }

  if (finalPm.status === 'FAILED') {
    console.error(
      Formatter.status('error', 'Failed to add payment method'),
    );
    console.log(
      Formatter.keyValue([['PM ID', finalPm.id]]),
    );
    process.exitCode = 1;
    return;
  }

  if (finalPm.status === 'EXPIRED') {
    console.error(
      Formatter.status(
        'error',
        'Session expired before the payment method was added',
      ),
    );
    console.log(
      Formatter.keyValue([['PM ID', finalPm.id]]),
    );
    process.exitCode = 1;
    return;
  }

  // Polling timed out without reaching a terminal status — PM is still
  // PENDING server-side. The operator can re-run with the same email to
  // resume (PENDING dropin PMs are overwritten/reused per Requirement 5.1).
  console.error(
    Formatter.status(
      'error',
      'Adding payment method did not complete within 30 minutes. Re-run with the same email to resume.',
    ),
  );
  console.log(
    Formatter.keyValue([['PM ID', pmId]]),
  );
  process.exitCode = 1;
}

interface PollOptions {
  intervalMs: number;
  timeoutMs: number;
  spinnerMessage: string;
}

/**
 * Poll GET /payment-methods/verification/status?payment_method_id=... at
 * `intervalMs` until the PM reaches a terminal status (ACTIVE / FAILED /
 * EXPIRED) or `timeoutMs` elapses.
 *
 * Shared between manual mode (3DS via email) and dropin mode (v3 add):
 * both modes hit the same v3 endpoint with API Key auth and only differ in
 * polling cadence and timeout.
 *
 * Returns the final PaymentMethod on terminal status, or
 * `{ id: pmId, status: 'PENDING' }` on timeout so callers can branch on
 * the final status uniformly.
 */
async function pollVerificationStatus(
  apiClient: ApiClient,
  apiKey: string,
  pmId: string,
  options: PollOptions,
): Promise<PaymentMethod> {
  const startTime = Date.now();
  const spinner = createSpinner(options.spinnerMessage);

  try {
    while (Date.now() - startTime < options.timeoutMs) {
      const result = await apiClient.get<PaymentMethod>(
        '/payment-methods/verification/status',
        { type: 'api-key', key: apiKey },
        { payment_method_id: pmId },
      );

      if (result.success && TERMINAL_STATUSES.has(result.data.status)) {
        return result.data;
      }

      await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
    }
    return { id: pmId, status: 'PENDING' } as PaymentMethod;
  } finally {
    spinner.stop();
  }
}
