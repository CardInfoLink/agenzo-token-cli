import { Command } from 'commander';
import { ConfigManager } from './config-manager.js';
import { CredentialStore } from './credential-store.js';
import { Formatter } from '../utils/formatter.js';

export function registerConfigCommand(
  program: Command,
  deps: { configManager: ConfigManager; credentialStore: CredentialStore },
): void {
  const configCmd = program.command('config').description('Manage CLI configuration');

  configCmd
    .command('set-host <host>')
    .description('Set API host (e.g. https://agent.everonet.com)')
    .action(async (host: string) => {
      await deps.configManager.setApiHost(host);
      // Auto-switch active org to one matching the new host
      const credentials = await deps.credentialStore.listAll();
      const match = credentials.find((c) => c.api_host === host);
      if (match) {
        await deps.configManager.setActiveOrg(match.org_id);
        console.log(Formatter.status('success', `API host set to: ${host}`));
        console.log(Formatter.status('info', `Switched to organization: ${match.org_name} (${match.org_id})`));
      } else {
        // No matching org — clear active org to prevent cross-env pollution
        const config = await deps.configManager.load();
        config.active_org = null;
        await deps.configManager.save(config);
        console.log(Formatter.status('success', `API host set to: ${host}`));
        console.log(Formatter.status('info', 'No organization found for this host. Please run login.'));
      }
    });

  configCmd
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      const config = await deps.configManager.load();
      console.log(Formatter.keyValue([
        ['API Host', config.api_host],
        ['API Path', config.api_path],
        ['Active Org', config.active_org ?? '(none)'],
      ]));
    });

  configCmd
    .command('reset-host')
    .description('Reset API host to default (https://agent.everonet.com)')
    .action(async () => {
      const defaultHost = 'https://agent.everonet.com';
      await deps.configManager.setApiHost(defaultHost);
      // Auto-switch active org
      const credentials = await deps.credentialStore.listAll();
      const match = credentials.find((c) => c.api_host === defaultHost);
      if (match) {
        await deps.configManager.setActiveOrg(match.org_id);
        console.log(Formatter.status('success', `API host reset to: ${defaultHost}`));
        console.log(Formatter.status('info', `Switched to organization: ${match.org_name} (${match.org_id})`));
      } else {
        const config = await deps.configManager.load();
        config.active_org = null;
        await deps.configManager.save(config);
        console.log(Formatter.status('success', `API host reset to: ${defaultHost}`));
        console.log(Formatter.status('info', 'No organization found for this host. Please run login.'));
      }
    });
}
