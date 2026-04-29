import { Command } from 'commander';
import { ApiClient } from './api/client.js';
import { ConfigManager } from './config/config-manager.js';
import { CredentialStore } from './config/credential-store.js';
import { KeyStore } from './config/key-store.js';
import { AuthService } from './auth/auth-service.js';
import { Formatter } from './utils/formatter.js';
import { CliError, AuthError } from './utils/errors.js';

// Auth commands
import { registerLoginCommand } from './auth/login.js';
import { registerLogoutCommand } from './auth/logout.js';

// Config commands
import { registerConfigCommand } from './config/set.js';

// Orgs commands
import { registerMeCommand } from './orgs/me.js';
import { registerUpdateCommand as registerOrgUpdateCommand } from './orgs/update.js';
import { registerListCommand as registerOrgListCommand } from './orgs/list.js';
import { registerSwitchCommand } from './orgs/switch.js';

// Developers commands
import { registerCreateCommand as registerDevCreateCommand } from './developers/create.js';
import { registerListCommand as registerDevListCommand } from './developers/list.js';
import { registerGetCommand as registerDevGetCommand } from './developers/get.js';
import { registerUpdateCommand as registerDevUpdateCommand } from './developers/update.js';

// Keys commands
import { registerCreateCommand as registerKeyCreateCommand } from './keys/create.js';
import { registerListCommand as registerKeyListCommand } from './keys/list.js';
import { registerGetCommand as registerKeyGetCommand } from './keys/get.js';
import { registerRotateCommand } from './keys/rotate.js';
import { registerDisableCommand as registerKeyDisableCommand } from './keys/disable.js';

// Payment methods commands
import { registerAddCommand } from './payment-methods/add.js';
import { registerListCommand as registerPmListCommand } from './payment-methods/list.js';
import { registerGetCommand as registerPmGetCommand } from './payment-methods/get.js';
import { registerDisableCommand as registerPmDisableCommand } from './payment-methods/disable.js';

// Payment tokens commands
import { registerCreateCommand as registerPtCreateCommand } from './payment-tokens/create.js';
import { registerListCommand as registerPtListCommand } from './payment-tokens/list.js';
import { registerGetCommand as registerPtGetCommand } from './payment-tokens/get.js';
import { registerRevokeCommand } from './payment-tokens/revoke.js';

async function main() {
  // Instantiate shared infrastructure
  const configManager = new ConfigManager();
  await configManager.ensureDirectories();

  const credentialStore = new CredentialStore();
  const keyStore = new KeyStore();

  const apiBaseUrl = await configManager.getApiBaseUrl();
  const apiClient = new ApiClient({ baseUrl: apiBaseUrl });

  const authService = new AuthService(apiClient, credentialStore, configManager);

  // Shared deps objects
  const controlPlaneDeps = { apiClient, authService };
  const runtimePlaneDeps = { apiClient };
  const keysDeps = { apiClient, authService, keyStore, configManager };
  const orgsDeps = { credentialStore, configManager };

  // Create program
  const program = new Command();
  program
    .name('agenzo-token-cli')
    .version('0.11.1')
    .description('Agent Payment API CLI')
    .option('--verbose', 'Show verbose logs')
    .option('--yes', 'Skip confirmation prompts (for automation/AI Agents)')
    .hook('preAction', () => {
      console.log('⚠️  BETA — This CLI is in closed beta. Features may change without notice. Stay tuned!\n');
    });

  // Register top-level auth commands
  registerLoginCommand(program, { authService });
  registerLogoutCommand(program, { authService });

  // Config command
  registerConfigCommand(program, { configManager });

  // Orgs command group
  const orgsCmd = program.command('orgs').description('Organization management');
  registerMeCommand(orgsCmd, controlPlaneDeps);
  registerOrgUpdateCommand(orgsCmd, controlPlaneDeps);
  registerOrgListCommand(orgsCmd, orgsDeps);
  registerSwitchCommand(orgsCmd, orgsDeps);

  // Developers command group
  const devsCmd = program.command('developers').description('Developer management');
  registerDevCreateCommand(devsCmd, controlPlaneDeps);
  registerDevListCommand(devsCmd, controlPlaneDeps);
  registerDevGetCommand(devsCmd, controlPlaneDeps);
  registerDevUpdateCommand(devsCmd, controlPlaneDeps);

  // Keys command group
  const keysCmd = program.command('keys').description('API Key management');
  registerKeyCreateCommand(keysCmd, keysDeps);
  registerKeyListCommand(keysCmd, controlPlaneDeps);
  registerKeyGetCommand(keysCmd, controlPlaneDeps);
  registerRotateCommand(keysCmd, keysDeps);
  registerKeyDisableCommand(keysCmd, controlPlaneDeps);

  // Payment methods command group
  const pmCmd = program.command('payment-methods').description('Payment method management');
  registerAddCommand(pmCmd, runtimePlaneDeps);
  registerPmListCommand(pmCmd, runtimePlaneDeps);
  registerPmGetCommand(pmCmd, runtimePlaneDeps);
  registerPmDisableCommand(pmCmd, runtimePlaneDeps);

  // Payment tokens command group
  const ptCmd = program.command('payment-tokens').description('Payment token management');
  registerPtCreateCommand(ptCmd, runtimePlaneDeps);
  registerPtListCommand(ptCmd, runtimePlaneDeps);
  registerPtGetCommand(ptCmd, runtimePlaneDeps);
  registerRevokeCommand(ptCmd, runtimePlaneDeps);

  // Parse and execute
  await program.parseAsync(process.argv);
}

// Global error handler
main().catch((error) => {
  if (error instanceof CliError) {
    console.error(Formatter.status('error', error.message));
    if (error instanceof AuthError) {
      console.error(Formatter.status('info', error.suggestion));
    }
  } else {
    console.error(Formatter.status('error', 'An unexpected error occurred'));
    console.error(
      Formatter.status('info', 'Retry with --verbose flag for detailed logs'),
    );
    if (process.argv.includes('--verbose')) {
      console.error(error);
    }
  }
  process.exit(1);
});
