import { Command } from 'commander';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { CommandResult } from '../types/commands.js';
import { resolveFormat, render } from '../utils/output.js';

interface OrgListItem {
  org_id: string;
  org_name: string;
  email: string;
  active: boolean;
}

export function registerListCommand(
  parent: Command,
  deps: { credentialStore: CredentialStore; configManager: ConfigManager },
): void {
  parent
    .command('list')
    .description('List all signed-in organizations')
    .action(async (_options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const credentials = await deps.credentialStore.listAll();
      const activeOrg = await deps.configManager.getActiveOrg();
      const currentHost = await deps.configManager.getApiHost();

      // Only show orgs that belong to the current api_host.
      const data: OrgListItem[] = credentials
        .filter((cred) => cred.api_host === currentHost)
        .map((cred) => ({
          org_id: cred.org_id,
          org_name: cred.org_name,
          email: cred.email,
          active: cred.org_id === activeOrg,
        }));

      const commandResult: CommandResult<OrgListItem[]> = {
        data,
        text: () => {
          if (data.length === 0) {
            return Formatter.status('info', 'No signed-in organizations');
          }
          const headers = ['', 'Org ID', 'Org Name', 'Email'];
          const rows = data.map((item) => [
            item.active ? '*' : '',
            item.org_id,
            item.org_name,
            item.email,
          ]);
          return Formatter.table(headers, rows);
        },
      };

      render(commandResult, { format });
    });
}
