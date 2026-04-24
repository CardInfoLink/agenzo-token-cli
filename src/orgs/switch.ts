import { Command } from 'commander';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { Formatter } from '../utils/formatter.js';

export function registerSwitchCommand(
  parent: Command,
  deps: { credentialStore: CredentialStore; configManager: ConfigManager },
): void {
  parent
    .command('switch <org_id>')
    .description('Switch active organization')
    .action(async (orgId: string) => {
      const exists = await deps.credentialStore.exists(orgId);
      if (!exists) {
        console.error(
          Formatter.status('error', `Organization ${orgId} not signed in locally`),
        );
        console.error(
          Formatter.status('info', 'Please run agenzo-token-cli login to sign in to this organization'),
        );
        return;
      }

      await deps.configManager.setActiveOrg(orgId);
      console.log(Formatter.status('success', `Switched to organization ${orgId}`));
    });
}
