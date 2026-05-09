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
      const credential = await deps.credentialStore.get(orgId);
      if (!credential) {
        console.error(
          Formatter.status('error', `Organization ${orgId} not signed in locally`),
        );
        console.error(
          Formatter.status('info', 'Please run agenzo-token-cli login to sign in to this organization'),
        );
        return;
      }

      const currentHost = await deps.configManager.getApiHost();
      if (credential.api_host && credential.api_host !== currentHost) {
        console.error(
          Formatter.status('error', `Organization ${orgId} belongs to a different environment (${credential.api_host})`),
        );
        return;
      }

      await deps.configManager.setActiveOrg(orgId);
      console.log(Formatter.status('success', `Switched to organization ${orgId}`));
    });
}
