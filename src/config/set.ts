import { Command } from 'commander';
import { ConfigManager } from './config-manager.js';
import { Formatter } from '../utils/formatter.js';

export function registerConfigCommand(
  program: Command,
  deps: { configManager: ConfigManager },
): void {
  const configCmd = program.command('config').description('Manage CLI configuration');

  configCmd
    .command('set-host <host>')
    .description('Set API host (e.g. https://agenzo-token.everonet.com)')
    .action(async (host: string) => {
      await deps.configManager.setApiHost(host);
      console.log(Formatter.status('success', `API host set to: ${host}`));
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
    .description('Reset API host to default (https://agenzo-token.everonet.com)')
    .action(async () => {
      const defaultHost = 'https://agenzo-token.everonet.com';
      await deps.configManager.setApiHost(defaultHost);
      console.log(Formatter.status('success', `API host reset to: ${defaultHost}`));
    });
}
