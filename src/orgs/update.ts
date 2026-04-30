import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';

export function registerUpdateCommand(
  parent: Command,
  deps: {
    apiClient: ApiClient;
    authService: AuthService;
    credentialStore: CredentialStore;
    configManager: ConfigManager;
  },
): void {
  parent
    .command('update')
    .description('Update current organization')
    .option('--name <name>', 'New organization name')
    .option('--email <email>', 'New email')
    .action(async (options) => {
      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.post<Organization>(
          '/organizations/me/update',
          { type: 'bearer', token },
          body,
        ),
      );

      if (result.success) {
        console.log(Formatter.status('success', 'Organization updated'));
        console.log(
          Formatter.keyValue([
            ['Org ID', result.data.id],
            ['Name', result.data.name],
            ['Email', result.data.email],
            ['Status', result.data.status],
          ]),
        );

        // Sync local credential cache with updated org info
        const activeOrg = await deps.configManager.getActiveOrg();
        if (activeOrg) {
          const cred = await deps.credentialStore.get(activeOrg);
          if (cred) {
            if (options.name) cred.org_name = result.data.name;
            await deps.credentialStore.save(cred);
          }
        }

        if (options.email) {
          console.log(
            Formatter.status('info', 'Email change requires verification at the new address'),
          );
        }
      } else {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
      }
    });
}
